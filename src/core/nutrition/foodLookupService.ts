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
import { assessProductQuality, dedupeProducts, QUALITY_PENALTY } from './productQuality';
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
 * One result of the search – whatever its source, ranked in one list (Phase 28). `score`:
 * relevance (`foodRanking.ts`, higher is better); `strong`: a clear match – the UI lists these
 * as "Passende Lebensmittel" and the rest as "Weitere Treffer".
 */
export type FoodSearchResult =
  /** A food stored on this device (own, saved product or a reference food used before). */
  | { kind: 'food'; food: Food; score: number; strong: boolean }
  /** A reference food (BLS) not used yet; it is stored on first use. */
  | { kind: 'reference'; reference: ReferenceFood; score: number; strong: boolean }
  /** A product of the online search, not saved yet; the user reviews it before it is stored. */
  | { kind: 'product'; product: ExternalProduct; score: number; strong: boolean };

/** How many reference foods enter the ranking at most. */
export const REFERENCE_RESULTS_LIMIT = 50;
/** How many results a search shows at most – the best ones of all sources together. */
export const SEARCH_RESULTS_LIMIT = 50;

/** The automatic online search, its throttle and its memory (Phase 27, automatic since 28). */
export const ONLINE_SEARCH = {
  /** Shortest search text sent online – shorter texts are answered well enough locally. */
  minQueryLength: 3,
  /** Pause in typing before the online search starts (no request per keystroke). */
  debounceMs: 700,
  /** Products asked for per search. */
  limit: 24,
  /** At most this many online searches per minute – below the provider's limit of 10. */
  perMinute: 6,
  /** A repeated search within this time is answered from memory, without a request. */
  cacheMs: 30 * 60_000,
  /** Searches kept in memory (this session only, never written to the database). */
  cacheEntries: 20,
} as const;

/**
 * Small, secondary bonus by source – never more than a fraction of a match level, so the
 * source never decides the order on its own (Phase 28). A product found online counts like a
 * saved product, adjusted by its data quality (`QUALITY_PENALTY`).
 */
export const SOURCE_BONUS = {
  custom: BONUS.custom,
  saved: BONUS.saved,
  reference: 0,
  online: 0,
} as const;

/** Bonus of a stored food: own food or deliberately saved product, plus personal use. */
const STORED_BONUS: Record<Food['source'], number> = {
  custom: SOURCE_BONUS.custom,
  external: SOURCE_BONUS.saved,
  local: SOURCE_BONUS.reference,
};

/**
 * Finding foods. One search over all sources – the user's foods, saved products, the bundled
 * reference data (BLS) and, once loaded, products from Open Food Facts – ranked together by
 * relevance (`foodRanking.ts`): the match decides, the source adds at most a small bonus.
 * The local part is offline and instant; the online products are fetched separately after a
 * pause in typing (`onlineProducts`) and passed back into `search`. Open Food Facts receives
 * nothing but the barcode or the search text.
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
   * The search over all sources, ranked together. `online`: products of the online search for
   * this query (`onlineProducts`) – without them the search is purely local. Each food appears
   * once: a reference food or online product that is already stored appears as the stored
   * food; online records of poor quality (C) are left out, limited ones (B) rank a little
   * lower. `lang` decides which name of a reference food counts as main.
   */
  async search(
    profileId: string,
    query: string,
    {
      referenceLimit = REFERENCE_RESULTS_LIMIT,
      lang = 'de',
      online = [],
    }: {
      referenceLimit?: number;
      lang?: 'de' | 'en';
      online?: readonly ExternalProduct[];
    } = {},
  ): Promise<FoodSearchResult[]> {
    if (query.trim() === '') return [];
    const [stored, usage] = await Promise.all([
      this.foods.list(profileId),
      this.foods.usageCounts(profileId).catch(() => new Map<string, number>()),
    ]);
    const analysis = analyzeQuery(query, [
      ...stored.flatMap((food) => (food.brand ? [food.brand] : [])),
      ...online.flatMap((product) => (product.brand ? [product.brand] : [])),
    ]);
    if (analysis.words.length === 0) return [];
    // Stored foods must stay searchable even if the reference data cannot be read.
    const references = await this.reference
      .rank(analysis, referenceLimit, { lang })
      .catch(() => []);

    const ranked: { score: number; name: string; result: FoodSearchResult }[] = [];
    const add = (score: number, name: string, result: FoodSearchResult) => {
      ranked.push({ score, name, result });
    };
    const storedCodes = new Set<string>();
    const storedProducts = new Set<string>();
    const storedBarcodes = new Set<string>();
    for (const food of stored) {
      if (food.origin) storedCodes.add(`${food.origin.dataset}:${food.origin.code}`);
      if (food.provider && food.externalId)
        storedProducts.add(`${food.provider}:${food.externalId}`);
      if (food.barcode) storedBarcodes.add(food.barcode);
      const score = relevance(
        {
          names: [prepareName(food.name)],
          brands: food.brand ? [normalizeSearchText(food.brand)] : [],
          dish: food.origin?.dataset === 'bls' && blsCategory(food.origin.code) === 'dishes',
          bonus: STORED_BONUS[food.source] + usageBonus(usage.get(food.id) ?? 0),
        },
        analysis,
      );
      if (score === null) continue;
      add(score, food.name, { kind: 'food', food, score, strong: score >= STRONG_MATCH });
    }
    for (const { reference, score } of references) {
      if (storedCodes.has(`${reference.dataset}:${reference.code}`)) continue;
      add(score, reference.name, {
        kind: 'reference',
        reference,
        score,
        strong: score >= STRONG_MATCH,
      });
    }
    for (const product of dedupeProducts(online)) {
      // Saved before (same record or same barcode): it is already listed as the stored food.
      if (storedProducts.has(`${product.provider}:${product.externalId}`)) continue;
      if (product.barcode && storedBarcodes.has(product.barcode)) continue;
      const quality = assessProductQuality(product);
      if (quality === 'C') continue;
      const score = relevance(
        {
          names: [prepareName(product.name)],
          brands: [product.brand, ...(product.stores ?? [])].flatMap((value) =>
            value ? [normalizeSearchText(value)] : [],
          ),
          categories: (product.categories ?? []).map(normalizeSearchText),
          bonus: SOURCE_BONUS.online + QUALITY_PENALTY[quality],
        },
        analysis,
      );
      // The provider's own match (a word we do not know) is not enough: no clear relation.
      if (score === null) continue;
      add(score, product.name, { kind: 'product', product, score, strong: score >= STRONG_MATCH });
    }
    return ranked
      .sort(compareRanked)
      .slice(0, SEARCH_RESULTS_LIMIT)
      .map((entry) => entry.result);
  }

  /**
   * Products from the provider for a search text – fetched after a pause in typing and passed
   * into `search`, which ranks them together with everything local. Sends nothing but the text
   * (see `FoodDataProvider`). A repeated search in this session is answered from memory (also
   * offline); more than `ONLINE_SEARCH.perMinute` requests per minute are refused locally
   * (`rate-limited`) before the provider has to. Poor records (quality C) and duplicates are
   * removed here. Provider errors (`offline`, `timeout`, …) are passed on – the local search is
   * unaffected.
   */
  async onlineProducts(
    query: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<ExternalProduct[]> {
    const search = this.provider.searchProducts?.bind(this.provider);
    const text = query.trim();
    const key = normalizeSearchText(text);
    if (!search || key.length < ONLINE_SEARCH.minQueryLength) return [];

    const now = this.now();
    const cached = this.cached(key, now);
    if (cached) return cached;
    this.onlineRequests = this.onlineRequests.filter((at) => now - at < 60_000);
    if (this.onlineRequests.length >= ONLINE_SEARCH.perMinute) {
      throw new FoodProviderError('rate-limited');
    }
    this.onlineRequests.push(now);
    const found = await search(text, { limit: ONLINE_SEARCH.limit, signal: options.signal });
    const products = dedupeProducts(
      found.filter((product) => assessProductQuality(product) !== 'C'),
    );
    this.remember(key, now, products);
    return products;
  }

  /** Products remembered for this search text, without a request; `null` when none. */
  cachedOnlineProducts(query: string): ExternalProduct[] | null {
    return this.cached(normalizeSearchText(query.trim()), this.now());
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
