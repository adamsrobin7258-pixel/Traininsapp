import {
  FoodProviderError,
  type ExternalProduct,
  type FoodDataProvider,
  type FoodProviderErrorCode,
  type FoodSearchOptions,
} from '@/core/nutrition';

/**
 * In-memory stand-in for an external food database. Records every call, so tests can check
 * exactly what would have been sent – and that nothing personal is part of it.
 */
export class FakeFoodProvider implements FoodDataProvider {
  readonly id = 'openfoodfacts';
  readonly displayName = 'Open Food Facts';
  readonly calls: { method: 'search' | 'barcode' | 'product'; value: string }[] = [];
  products: ExternalProduct[] = [];
  /** Makes every request fail with this error. */
  failWith: FoodProviderErrorCode | null = null;

  search(query: string, options: FoodSearchOptions): Promise<ExternalProduct[]> {
    this.calls.push({ method: 'search', value: query });
    if (this.failWith) return Promise.reject(new FoodProviderError(this.failWith));
    const needle = query.trim().toLowerCase();
    return Promise.resolve(
      this.products
        .filter((p) => `${p.name} ${p.brand ?? ''}`.toLowerCase().includes(needle))
        .slice(0, options.limit),
    );
  }

  lookupBarcode(barcode: string): Promise<ExternalProduct | null> {
    this.calls.push({ method: 'barcode', value: barcode });
    if (this.failWith) return Promise.reject(new FoodProviderError(this.failWith));
    return Promise.resolve(this.products.find((p) => p.barcode === barcode) ?? null);
  }

  getProduct(externalId: string): Promise<ExternalProduct | null> {
    this.calls.push({ method: 'product', value: externalId });
    if (this.failWith) return Promise.reject(new FoodProviderError(this.failWith));
    return Promise.resolve(this.products.find((p) => p.externalId === externalId) ?? null);
  }
}

/** A typical product: 100 g, all main values known. */
export function externalProduct(change: Partial<ExternalProduct> = {}): ExternalProduct {
  return {
    provider: 'openfoodfacts',
    externalId: '4001234567890',
    name: 'Skyr Natur',
    brand: 'Milbona',
    barcode: '4001234567890',
    reference: { amount: 100, unit: 'g' },
    nutrients: {
      energyKcal: 63,
      proteinG: 11,
      carbsG: 4,
      fatG: 0.2,
      fiberG: null,
      sugarG: 4,
      saturatedFatG: 0.1,
    },
    servings: [],
    missing: [],
    ...change,
  };
}
