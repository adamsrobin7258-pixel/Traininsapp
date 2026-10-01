import { normalizeBarcode } from '../barcode';
import type { FoodServing } from '../food';
import { MAIN_NUTRIENTS, type MainNutrient } from '../nutrients';
import {
  FoodProviderError,
  type ExternalNutrients,
  type ExternalProduct,
  type FoodDataProvider,
  type FoodSearchOptions,
} from '../provider';
import type { MeasureUnit } from '../units';

/**
 * Open Food Facts (https://world.openfoodfacts.org), a free, collaborative food database.
 * Data licence: Open Database License (ODbL); product data must be attributed to
 * "Open Food Facts" wherever it is shown (see docs/OPEN_FOOD_FACTS.md).
 *
 * Endpoints (checked against the official documentation, API v2 / Search-a-licious):
 * - Product by barcode: GET https://world.openfoodfacts.org/api/v2/product/{barcode}?fields=…
 * - Full-text search:   GET https://search.openfoodfacts.org/search?q=…&langs=…&page_size=…&fields=…
 *   (full-text search is not part of API v2; Search-a-licious is the official search service)
 *
 * Rules of the service: a custom User-Agent, at most 15 product and 10 search requests per
 * minute per user – the app only searches on an explicit action and never retries on its own.
 */
export const OPEN_FOOD_FACTS = {
  id: 'openfoodfacts',
  displayName: 'Open Food Facts',
  productUrl: 'https://world.openfoodfacts.org/api/v2/product/',
  searchUrl: 'https://search.openfoodfacts.org/search',
  /** Only what the app maps – keeps responses small on mobile connections. */
  fields: [
    'code',
    'product_name',
    'product_name_de',
    'product_name_en',
    'generic_name',
    'brands',
    'quantity',
    'product_quantity_unit',
    'serving_size',
    'serving_quantity',
    'serving_quantity_unit',
    'nutriments',
  ],
  searchLanguages: 'de,en',
  timeoutMs: 10_000,
  minQueryLength: 2,
} as const;

/** What the provider needs from the platform: a JSON GET (native HTTP or fetch). */
export interface JsonHttpClient {
  getJson(
    url: string,
    options: { headers: Record<string, string>; timeoutMs: number; signal?: AbortSignal },
  ): Promise<
    | { ok: true; status: number; data: unknown }
    | { ok: false; reason: 'offline' | 'timeout' | 'http' | 'invalid'; status?: number }
  >;
}

export class OpenFoodFactsProvider implements FoodDataProvider {
  readonly id = OPEN_FOOD_FACTS.id;
  readonly displayName = OPEN_FOOD_FACTS.displayName;

  /**
   * @param userAgent identifies the app (name/version/platform) – never the user.
   */
  constructor(
    private readonly http: JsonHttpClient,
    private readonly userAgent: string,
  ) {}

  async search(query: string, options: FoodSearchOptions): Promise<ExternalProduct[]> {
    const text = query.trim();
    if (text.length < OPEN_FOOD_FACTS.minQueryLength) return [];
    const params = new URLSearchParams({
      q: text,
      langs: OPEN_FOOD_FACTS.searchLanguages,
      page_size: String(Math.min(Math.max(1, options.limit), 50)),
      fields: OPEN_FOOD_FACTS.fields.join(','),
    });
    const data = await this.get(
      `${OPEN_FOOD_FACTS.searchUrl}?${params.toString()}`,
      options.signal,
    );
    const hits = isRecord(data) ? (data.hits ?? data.products) : undefined;
    if (!Array.isArray(hits)) throw new FoodProviderError('invalid-response');
    return hits
      .map((hit) => mapOpenFoodFactsProduct(hit, options.locale))
      .filter((product): product is ExternalProduct => product !== null && product.name !== '');
  }

  async lookupBarcode(
    barcode: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<ExternalProduct | null> {
    const code = normalizeBarcode(barcode);
    if (!code) return null;
    const params = new URLSearchParams({ fields: OPEN_FOOD_FACTS.fields.join(',') });
    const data = await this.get(
      `${OPEN_FOOD_FACTS.productUrl}${code}?${params.toString()}`,
      options.signal,
    );
    if (!isRecord(data)) throw new FoodProviderError('invalid-response');
    // status 1 = found, 0 = unknown barcode (also returned with HTTP 404).
    if (data.status === 0 || data.status === '0') return null;
    if (!isRecord(data.product)) {
      if (data.status === undefined) throw new FoodProviderError('invalid-response');
      return null;
    }
    return mapOpenFoodFactsProduct({ code, ...data.product }, 'de');
  }

  /** Open Food Facts identifies products by their barcode. */
  getProduct(externalId: string, options?: { signal?: AbortSignal }) {
    return this.lookupBarcode(externalId, options);
  }

  private async get(url: string, signal: AbortSignal | undefined): Promise<unknown> {
    const result = await this.http.getJson(url, {
      headers: { 'User-Agent': this.userAgent },
      timeoutMs: OPEN_FOOD_FACTS.timeoutMs,
      signal,
    });
    if (result.ok) return result.data;
    if (result.reason === 'offline') throw new FoodProviderError('offline');
    if (result.reason === 'timeout') throw new FoodProviderError('timeout');
    if (result.reason === 'invalid') throw new FoodProviderError('invalid-response');
    // Open Food Facts answers 503 (and some proxies 429) when the rate limit is reached.
    if (result.status === 429 || result.status === 503) {
      throw new FoodProviderError('rate-limited');
    }
    throw new FoodProviderError('unavailable');
  }
}

// ── Mapping ──────────────────────────────────────────────────────────────────

const NUTRIENT_KEYS: Record<keyof ExternalNutrients, string> = {
  energyKcal: 'energy-kcal_100g',
  proteinG: 'proteins_100g',
  carbsG: 'carbohydrates_100g',
  fatG: 'fat_100g',
  fiberG: 'fiber_100g',
  sugarG: 'sugars_100g',
  saturatedFatG: 'saturated-fat_100g',
};

const KJ_PER_KCAL = 4.184;
/** Values above these per 100 g/ml are physically impossible and treated as not stated. */
const MAX_PER_100 = { energyKcal: 950, grams: 100 } as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A number or numeric string ≥ 0; anything else is "not stated" (`null`). */
function amount(value: unknown): number | null {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(',', '.'))
        : NaN;
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed === '' ? null : trimmed;
}

function firstBrand(value: unknown): string | null {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  for (const item of list) {
    const brand = text(item);
    if (brand) return brand.slice(0, 120);
  }
  return null;
}

/** Liquids are stated per 100 ml, everything else per 100 g. */
function referenceUnit(product: Record<string, unknown>): MeasureUnit {
  const unit = text(product.product_quantity_unit)?.toLowerCase();
  if (unit === 'ml' || unit === 'l' || unit === 'cl') return 'ml';
  if (unit === 'g' || unit === 'kg') return 'g';
  const quantity = text(product.quantity)?.toLowerCase() ?? '';
  return /\d\s*(ml|cl|l)\b/.test(quantity) ? 'ml' : 'g';
}

function nutrients(raw: unknown): ExternalNutrients {
  const values = isRecord(raw) ? raw : {};
  const result = Object.fromEntries(
    (Object.keys(NUTRIENT_KEYS) as (keyof ExternalNutrients)[]).map((key) => {
      const value = amount(values[NUTRIENT_KEYS[key]]);
      const max = key === 'energyKcal' ? MAX_PER_100.energyKcal : MAX_PER_100.grams;
      return [key, value !== null && value <= max ? value : null];
    }),
  ) as ExternalNutrients;
  // Some products only state kJ; that is a unit conversion, not an estimate.
  if (result.energyKcal === null) {
    const kj = amount(values['energy-kj_100g'] ?? values.energy_100g);
    const kcal = kj === null ? null : Math.round((kj / KJ_PER_KCAL) * 10) / 10;
    result.energyKcal = kcal !== null && kcal <= MAX_PER_100.energyKcal ? kcal : null;
  }
  return result;
}

function servings(product: Record<string, unknown>, unit: MeasureUnit): FoodServing[] {
  const size = amount(product.serving_quantity);
  if (size === null || size <= 0 || size > 10_000) return [];
  const servingUnit = text(product.serving_quantity_unit)?.toLowerCase();
  const amountUnit: MeasureUnit = servingUnit === 'ml' ? 'ml' : servingUnit === 'g' ? 'g' : unit;
  return [
    {
      unit: 'serving',
      amount: size,
      amountUnit,
      label: text(product.serving_size)?.slice(0, 40) ?? null,
    },
  ];
}

/**
 * Maps one Open Food Facts product to the app's model. Nutrients are per 100 g (or 100 ml);
 * values that are missing stay `null` and are listed in `missing`. Returns `null` for entries
 * without a usable barcode.
 */
export function mapOpenFoodFactsProduct(raw: unknown, locale: string): ExternalProduct | null {
  if (!isRecord(raw)) return null;
  const code = normalizeBarcode(
    typeof raw.code === 'string' || typeof raw.code === 'number' ? String(raw.code) : '',
  );
  if (!code) return null;
  const language = locale.slice(0, 2).toLowerCase();
  const name =
    text(raw[`product_name_${language}`]) ??
    text(raw.product_name) ??
    text(raw.product_name_en) ??
    text(raw.product_name_de) ??
    text(raw.generic_name) ??
    '';
  const unit = referenceUnit(raw);
  const values = nutrients(raw.nutriments);
  const missing: MainNutrient[] = MAIN_NUTRIENTS.filter((key) => values[key] === null);
  return {
    provider: OPEN_FOOD_FACTS.id,
    externalId: code,
    name: name.slice(0, 120),
    brand: firstBrand(raw.brands),
    barcode: code,
    reference: { amount: 100, unit },
    nutrients: values,
    servings: servings(raw, unit),
    missing,
  };
}
