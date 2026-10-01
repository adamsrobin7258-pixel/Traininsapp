import { normalizeBarcode } from './barcode';
import { NutritionError } from './errors';
import type { Food } from './food';
import type { FoodService } from './foodService';
import type { ExternalProduct, FoodDataProvider } from './provider';

export type BarcodeLookup =
  /** Known on this device – no request was made. */
  | { kind: 'local'; food: Food }
  /** Found at the provider; the user reviews it before it is stored. */
  | { kind: 'external'; product: ExternalProduct }
  | { kind: 'not-found'; barcode: string };

export interface OnlineResult {
  product: ExternalProduct;
  /** The local food when this product was imported before (no duplicate is offered). */
  local: Food | null;
}

/**
 * Finding foods beyond the user's own list: barcode lookup (local first, then the provider)
 * and an explicit online search. Only the barcode or the search text leaves the device – the
 * methods have no access to anything else. Provider failures surface as FoodProviderError;
 * local foods stay usable regardless.
 */
export class FoodLookupService {
  constructor(
    private readonly foods: FoodService,
    private readonly provider: FoodDataProvider,
  ) {}

  get providerName(): string {
    return this.provider.displayName;
  }

  get providerId(): string {
    return this.provider.id;
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

  /** Explicit online search; results that already exist locally are marked as such. */
  async searchOnline(
    profileId: string,
    query: string,
    options: { locale: string; limit?: number; signal?: AbortSignal },
  ): Promise<OnlineResult[]> {
    const products = await this.provider.search(query, {
      limit: options.limit ?? 20,
      locale: options.locale,
      signal: options.signal,
    });
    const results: OnlineResult[] = [];
    for (const product of products) {
      const local =
        (await this.foods.findImported(profileId, product.provider, product.externalId)) ??
        (product.barcode ? await this.localByBarcode(profileId, product.barcode) : null);
      results.push({ product, local });
    }
    return results;
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
