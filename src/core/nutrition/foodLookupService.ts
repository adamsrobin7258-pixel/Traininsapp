import { normalizeBarcode } from './barcode';
import { blsCategory } from './category';
import { NutritionError } from './errors';
import type { Food } from './food';
import {
  analyzeQuery,
  BONUS,
  compareRanked,
  prepareName,
  relevance,
  STRONG_MATCH,
  usageBonus,
} from './foodRanking';
import type { FoodService } from './foodService';
import { FoodProviderError, type ExternalProduct, type FoodDataProvider } from './provider';
import type { ReferenceCatalog, ReferenceDatasetInfo, ReferenceFood } from './reference';
import { normalizeSearchText } from './search';

export type BarcodeLookup =
  /** Known on this device – no request was made. */
  | { kind: 'local'; food: Food }
  /** Found at the provider; the user reviews it before it is stored. */
  | { kind: 'external'; product: ExternalProduct }
  | { kind: 'not-found'; barcode: string };

/**
 * `score`: relevance (`foodRanking.ts`, higher is better); `strong`: a clear match – the UI
 * lists these as "Passende Lebensmittel" and the rest as "Weitere Treffer".
 */
export type FoodSearchResult =
  /** A food stored on this device (own, saved product or a reference food used before). */
  | { kind: 'food'; food: Food; score: number; strong: boolean }
  /** A reference food (BLS) not used yet; it is stored on first use. */
  | { kind: 'reference'; reference: ReferenceFood; score: number; strong: boolean };

/** A product of the online search; already saved ones are offered as the stored food. */
export type OnlineSearchResult =
  | { kind: 'saved'; food: Food; strong: boolean }
  | { kind: 'product'; product: ExternalProduct; strong: boolean };

/** How many reference foods a search returns at most. */
export const REFERENCE_RESULTS_LIMIT = 50;

/** The online search, its throttle and its memory (Phase 27). */
export const ONLINE_SEARCH = {
  /** Shortest search text sent online. */
  minQueryLength: 2,
  /** Products asked for per search. */
  limit: 24,
  /** At most this many online searches per minute – below the provider's limit of 10. */
  perMinute: 6,
  /** A repeated search within this time is answered from memory, without a request. */
  cacheMs: 30 * 60_000,
  /** Searches kept in memory (this session only, never written to the database). */
  cacheEntries: 20,
} as const;

/** Bonus of a stored food: own food or deliberately saved product, plus personal use. */
const SOURCE_BONUS: Record<Food['source'], number> = {
  custom: BONUS.custom,
  external: BONUS.saved,
  local: 0,
};

/**
 * Finding foods. The normal search is completely offline: the user's foods, saved products
 * and the bundled reference data (BLS), ranked together by relevance (`foodRanking.ts`) with a
 * bounded bonus for personal use. Open Food Facts is asked for an unknown barcode – and, only
 * on explicit request, for more products (`searchOnline`). It receives nothing but the barcode
 * or the search text.
 */
export class FoodLookupService {
  constructor(
    private readonly foods: FoodService,
    /** Barcode fallback (Open Food Facts). */
    private readonly provider: FoodDataProvider,
    /** Bundled reference data (BLS). */
    private readonly reference: ReferenceCatalog,
    /** Milliseconds now – for the online throttle and memory. */
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Online searches of this session: normalised query → products (memory only). */
  private readonly onlineCache = new Map<string, { at: number; products: ExternalProduct[] }>();
  /** Times of the recent online requests (throttle). */
  private onlineRequests: number[] = [];

  /** True when the provider offers a product search at all. */
  get canSearchOnline(): boolean {
    return typeof this.provider.searchProducts === 'function';
  }

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
   * Offline search over stored foods and the reference data, ranked together by relevance:
   * the meaning of the name first (`foodRanking.ts`), then a bounded bonus for own foods,
   * saved products and personal use. A reference food that is already stored appears only
   * once, as the stored food. `lang` decides which name of a reference food counts as main.
   */
  async search(
    profileId: string,
    query: string,
    {
      referenceLimit = REFERENCE_RESULTS_LIMIT,
      lang = 'de',
    }: { referenceLimit?: number; lang?: 'de' | 'en' } = {},
  ): Promise<FoodSearchResult[]> {
    if (query.trim() === '') return [];
    const [stored, usage] = await Promise.all([
      this.foods.list(profileId),
      this.foods.usageCounts(profileId).catch(() => new Map<string, number>()),
    ]);
    const analysis = analyzeQuery(
      query,
      stored.flatMap((food) => (food.brand ? [food.brand] : [])),
    );
    if (analysis.words.length === 0) return [];
    // Stored foods must stay searchable even if the reference data cannot be read.
    const references = await this.reference
      .rank(analysis, referenceLimit, { lang })
      .catch(() => []);

    const ranked: { score: number; name: string; result: FoodSearchResult }[] = [];
    const storedCodes = new Set<string>();
    for (const food of stored) {
      if (food.origin) storedCodes.add(`${food.origin.dataset}:${food.origin.code}`);
      const score = relevance(
        {
          names: [prepareName(food.name)],
          brands: food.brand ? [normalizeSearchText(food.brand)] : [],
          dish: food.origin?.dataset === 'bls' && blsCategory(food.origin.code) === 'dishes',
          bonus: SOURCE_BONUS[food.source] + usageBonus(usage.get(food.id) ?? 0),
        },
        analysis,
      );
      if (score === null) continue;
      ranked.push({
        score,
        name: food.name,
        result: { kind: 'food', food, score, strong: score >= STRONG_MATCH },
      });
    }
    for (const { reference, score } of references) {
      if (storedCodes.has(`${reference.dataset}:${reference.code}`)) continue;
      ranked.push({
        score,
        name: reference.name,
        result: { kind: 'reference', reference, score, strong: score >= STRONG_MATCH },
      });
    }
    return ranked.sort(compareRanked).map((entry) => entry.result);
  }

  /**
   * The optional second level: more products from the provider for a search text, on the
   * user's explicit request only. Sends nothing but the text (see `FoodDataProvider`). A
   * repeated search in this session is answered from memory; more than
   * `ONLINE_SEARCH.perMinute` requests per minute are refused locally (`rate-limited`) before
   * the provider has to. Results are ranked like the local search; products saved before are
   * returned as the stored food. Offline the provider error (`offline`) is passed on – the
   * local search is unaffected.
   */
  async searchOnline(
    profileId: string,
    query: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<OnlineSearchResult[]> {
    const search = this.provider.searchProducts?.bind(this.provider);
    const text = query.trim();
    const key = normalizeSearchText(text);
    if (!search || key.length < ONLINE_SEARCH.minQueryLength) return [];

    const now = this.now();
    let products = this.cached(key, now);
    if (!products) {
      this.onlineRequests = this.onlineRequests.filter((at) => now - at < 60_000);
      if (this.onlineRequests.length >= ONLINE_SEARCH.perMinute) {
        throw new FoodProviderError('rate-limited');
      }
      this.onlineRequests.push(now);
      products = await search(text, { limit: ONLINE_SEARCH.limit, signal: options.signal });
      this.remember(key, now, products);
    }

    const stored = await this.foods.list(profileId, { includeInactive: true });
    const analysis = analyzeQuery(text, [
      ...stored.flatMap((food) => (food.brand ? [food.brand] : [])),
      ...products.flatMap((product) => (product.brand ? [product.brand] : [])),
    ]);
    const ranked: { score: number; name: string; result: OnlineSearchResult }[] = [];
    const seen = new Set<string>();
    for (const product of products) {
      if (seen.has(product.externalId)) continue;
      seen.add(product.externalId);
      const saved = stored.find(
        (food) => food.provider === product.provider && food.externalId === product.externalId,
      );
      const score =
        relevance(
          {
            names: [prepareName(product.name)],
            brands: [product.brand, ...(product.stores ?? [])].flatMap((value) =>
              value ? [normalizeSearchText(value)] : [],
            ),
          },
          analysis,
        ) ?? // The provider found it (e.g. by a word we do not know): keep it, last.
        0;
      const strong = score >= STRONG_MATCH;
      ranked.push({
        score,
        name: product.name,
        result:
          saved && saved.active
            ? { kind: 'saved', food: saved, strong }
            : { kind: 'product', product, strong },
      });
    }
    return ranked.sort(compareRanked).map((entry) => entry.result);
  }

  private cached(key: string, now: number): ExternalProduct[] | null {
    const hit = this.onlineCache.get(key);
    if (!hit) return null;
    if (now - hit.at > ONLINE_SEARCH.cacheMs) {
      this.onlineCache.delete(key);
      return null;
    }
    return hit.products;
  }

  private remember(key: string, at: number, products: ExternalProduct[]) {
    this.onlineCache.delete(key);
    this.onlineCache.set(key, { at, products });
    while (this.onlineCache.size > ONLINE_SEARCH.cacheEntries) {
      const oldest = this.onlineCache.keys().next().value;
      if (oldest === undefined) break;
      this.onlineCache.delete(oldest);
    }
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
