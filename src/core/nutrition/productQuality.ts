import { MAIN_NUTRIENTS } from './nutrients';
import type { ExternalProduct } from './provider';
import { normalizeSearchText } from './search';

/**
 * Data quality of products from an external database (Open Food Facts) for the search
 * (Phase 28). The balanced mode:
 *
 * - **A** – a name, all main values (kcal, protein, carbohydrates, fat), consistent with each
 *   other, and no warning of the provider about the nutrition values.
 * - **B** – usable, but something is missing or doubtful: a main value, the brand, the
 *   provider marks the nutrition facts as incomplete or warns about them, a very low
 *   completeness, an unclear package unit. Listed, but behind an A product of the same
 *   relevance (`QUALITY_PENALTY`).
 * - **C** – not usable for logging: no name, no calories, no macro at all, values that
 *   contradict each other, or errors the provider detected itself. Hidden in the normal search
 *   (the barcode scan still shows any product – the user reviews it there).
 *
 * "Complete" never means "correct": completeness is one hint among several and never decides
 * on its own. The app speaks of data quality only – never of a verified product.
 */
export type ProductQuality = 'A' | 'B' | 'C';

/** Points a B product loses in the ranking – less than the gap between two match levels. */
export const QUALITY_PENALTY: Record<ProductQuality, number> = { A: 0, B: -12, C: -Infinity };

/** Below this completeness (0–1) a record counts as sparse. */
const SPARSE_COMPLETENESS = 0.4;
/** Provider warnings that concern the values the app uses. */
const NUTRITION_WARNING = /nutri|energy|kcal|kj|fat|protein|carbohydrate|sugar|fiber|salt/;

/**
 * Whether the stated energy fits the stated macros (4/4/9 kcal per g). Generous on purpose:
 * fibre, polyols and alcohol add energy the three macros do not show, rounding on labels adds
 * more. Only clear contradictions count ("500 kcal" for a product with 2 g of everything).
 */
function energyContradicts(product: ExternalProduct): boolean {
  const { energyKcal, proteinG, carbsG, fatG } = product.nutrients;
  if (energyKcal === null || proteinG === null || carbsG === null || fatG === null) return false;
  if (proteinG + carbsG + fatG > 105) return true;
  const fromMacros = 4 * proteinG + 4 * carbsG + 9 * fatG;
  return fromMacros > energyKcal * 1.5 + 40 || fromMacros < energyKcal * 0.5 - 40;
}

export function assessProductQuality(product: ExternalProduct): ProductQuality {
  const { energyKcal, proteinG, carbsG, fatG } = product.nutrients;
  const signals = product.qualitySignals;
  if (product.name.trim() === '') return 'C';
  if (energyKcal === null) return 'C';
  if (proteinG === null && carbsG === null && fatG === null) return 'C';
  if (energyContradicts(product)) return 'C';
  if (signals && signals.errors.length > 0) return 'C';

  const missingMain = MAIN_NUTRIENTS.some((key) => product.nutrients[key] === null);
  const doubtful =
    missingMain ||
    !product.brand ||
    signals?.nutritionComplete === false ||
    (signals?.completeness ?? 1) < SPARSE_COMPLETENESS ||
    (signals?.warnings ?? []).some((warning) => NUTRITION_WARNING.test(warning)) ||
    product.reference.amount <= 0;
  return doubtful ? 'B' : 'A';
}

const QUALITY_ORDER: Record<ProductQuality, number> = { A: 0, B: 1, C: 2 };

/** The better of two records of the same product: quality, then fewer missing values. */
function better(a: ExternalProduct, b: ExternalProduct): ExternalProduct {
  const order = QUALITY_ORDER[assessProductQuality(a)] - QUALITY_ORDER[assessProductQuality(b)];
  if (order !== 0) return order < 0 ? a : b;
  if (a.missing.length !== b.missing.length) return a.missing.length < b.missing.length ? a : b;
  return a; // the provider's order decides
}

/**
 * Key of a record without a shared barcode: brand, name and package size – all three must be
 * known, so different variants ("Magerquark 250 g" / "500 g") or an unknown size never merge.
 */
function variantKey(product: ExternalProduct): string | null {
  const brand = normalizeSearchText(product.brand ?? '');
  const name = normalizeSearchText(product.name);
  const size = normalizeSearchText(product.packageSize ?? '').replace(/ /g, '');
  if (brand === '' || name === '' || size === '') return null;
  return `${brand}|${name}|${size}`;
}

/** Same energy within 5 % (or 5 kcal): two records of one product, not two recipes. */
function sameEnergy(a: ExternalProduct, b: ExternalProduct): boolean {
  const x = a.nutrients.energyKcal;
  const y = b.nutrients.energyKcal;
  if (x === null || y === null) return x === y;
  return Math.abs(x - y) <= Math.max(5, 0.05 * Math.max(x, y));
}

/**
 * Removes duplicate records, keeping the better one where it stood:
 * 1. the same barcode is the same product – the better record stays;
 * 2. otherwise only brand + name + package size together with matching energy merge.
 * Cautious by design: when in doubt both stay (a variant must never disappear).
 */
export function dedupeProducts(products: readonly ExternalProduct[]): ExternalProduct[] {
  const kept: ExternalProduct[] = [];
  const byBarcode = new Map<string, number>();
  const byVariant = new Map<string, number>();
  for (const product of products) {
    const barcode = product.barcode ?? product.externalId;
    const sameCode = byBarcode.get(barcode);
    const key = variantKey(product);
    const sameVariant = key === null ? undefined : byVariant.get(key);
    const index =
      sameCode ??
      (sameVariant !== undefined && sameEnergy(kept[sameVariant] as ExternalProduct, product)
        ? sameVariant
        : undefined);
    if (index === undefined) {
      byBarcode.set(barcode, kept.length);
      if (key !== null) byVariant.set(key, kept.length);
      kept.push(product);
      continue;
    }
    kept[index] = better(kept[index] as ExternalProduct, product);
    byBarcode.set(barcode, index);
  }
  return kept;
}
