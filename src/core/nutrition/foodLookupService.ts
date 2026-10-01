import { normalizeBarcode } from './barcode';
import { NutritionError } from './errors';
import type { Food } from './food';
import type { FoodService } from './foodService';
import type { ExternalProduct, FoodDataProvider } from './provider';
import type { ReferenceCatalog, ReferenceDatasetInfo, ReferenceFood } from './reference';
import { bestScore, compareMatches, matchScore, searchKey, searchWords } from './search';

export type BarcodeLookup =
  /** Known on this device – no request was made. */
  | { kind: 'local'; food: Food }
  /** Found at the provider; the user reviews it before it is stored. */
  | { kind: 'external'; product: ExternalProduct }
  | { kind: 'not-found'; barcode: string };

export type FoodSearchResult =
  /** A food stored on this device (own, saved product or a reference food used before). */
  | { kind: 'food'; food: Food }
  /** A reference food (BLS) not used yet; it is stored on first use. */
  | { kind: 'reference'; reference: ReferenceFood };

/** How many reference foods a search returns at most. */
export const REFERENCE_RESULTS_LIMIT = 50;

/** Search order: own foods, then saved products, then reference data (BLS). */
const GROUP: Record<Food['source'], number> = { custom: 0, external: 1, local: 2 };

/**
 * Finding foods. The normal search is completely offline: the user's foods and the bundled
 * reference data (BLS). An external provider (Open Food Facts) is only asked for a barcode
 * that is unknown on this device – and receives nothing but that barcode.
 */
export class FoodLookupService {
  constructor(
    private readonly foods: FoodService,
    /** Barcode fallback (Open Food Facts). */
    private readonly provider: FoodDataProvider,
    /** Bundled reference data (BLS). */
    private readonly reference: ReferenceCatalog,
  ) {}

  get providerName(): string {
    return this.provider.displayName;
  }

  get providerId(): string {
    return this.provider.id;
  }

  /** Attribution facts of the bundled reference data; `null` when none is bundled. */
  referenceInfo(): Promise<ReferenceDatasetInfo | null> {
    return this.reference.info();
  }

  /**
   * Offline search over stored foods and the reference data. Every query word must appear
   * (case, accents and umlauts ignored); within each group the best match comes first. A
   * reference food that is already stored appears only once, as the stored food.
   */
  async search(
    profileId: string,
    query: string,
    { referenceLimit = REFERENCE_RESULTS_LIMIT }: { referenceLimit?: number } = {},
  ): Promise<FoodSearchResult[]> {
    const words = searchWords(query);
    if (words.length === 0) return [];
    const [stored, references] = await Promise.all([
      this.foods.list(profileId),
      // Stored foods must stay searchable even if the reference data cannot be read.
      this.reference.search(query, referenceLimit).catch(() => []),
    ]);

    const ranked: { group: number; score: number; name: string; result: FoodSearchResult }[] = [];
    const storedCodes = new Set<string>();
    for (const food of stored) {
      if (food.origin) storedCodes.add(`${food.origin.dataset}:${food.origin.code}`);
      const score = matchScore(searchKey(food.name, food.brand), words);
      if (score === null) continue;
      ranked.push({
        group: GROUP[food.source],
        score,
        name: food.name,
        result: { kind: 'food', food },
      });
    }
    for (const reference of references) {
      if (storedCodes.has(`${reference.dataset}:${reference.code}`)) continue;
      const keys = [searchKey(reference.name), searchKey(reference.nameEn)];
      const score = bestScore(keys, words) ?? 5;
      ranked.push({
        group: GROUP.local,
        score,
        name: reference.name,
        result: { kind: 'reference', reference },
      });
    }
    return ranked.sort((a, b) => a.group - b.group || compareMatches(a, b)).map((r) => r.result);
  }

  /** Stores a reference food on first use (unchanged values) and returns the stored food. */
  async useReference(reference: ReferenceFood): Promise<Food> {
    const current = await this.reference.get(reference.code);
    if (!current) throw new NutritionError('not-found');
    return this.foods.ensureReference(current);
  }

  async lookupBarcode(
    profileId: string,
    input: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<BarcodeLookup> {
    const barcode = normalizeBarcode(input);
    if (!barcode) throw new NutritionError('invalid-barcode');

    // 1. A known barcode is answered locally: fast, offline and without a request.
    const local = await this.localByBarcode(profileId, barcode);
    if (local) return { kind: 'local', food: local };

    // 2. Unknown here: ask the provider (only the barcode is sent).
    const product = await this.provider.lookupBarcode(barcode, options);
    if (!product) return { kind: 'not-found', barcode };
    const imported = await this.foods.findImported(profileId, product.provider, product.externalId);
    if (imported) return { kind: 'local', food: await this.reactivated(profileId, imported) };
    return { kind: 'external', product };
  }

  /** Active local food with the barcode; a hidden one is shown again (the user scanned it). */
  private async localByBarcode(profileId: string, barcode: string): Promise<Food | null> {
    const matches = await this.foods.findByBarcode(profileId, barcode);
    const food = matches.find((f) => f.active) ?? matches[0];
    return food ? this.reactivated(profileId, food) : null;
  }

  private async reactivated(profileId: string, food: Food): Promise<Food> {
    if (food.active || food.profileId !== profileId) return food;
    await this.foods.setActive(profileId, food.id, true);
    return { ...food, active: true };
  }
}
