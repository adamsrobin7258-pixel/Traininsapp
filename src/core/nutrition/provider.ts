import type { FoodServing, ReferenceQuantity } from './food';
import type { MainNutrient, Nutrients } from './nutrients';

/**
 * A complete product ready to be stored locally (all main nutrients known). Contains food
 * data only – never personal data.
 */
export interface ExternalFood {
  /** Identifier of the provider, e.g. "openfoodfacts". */
  provider: string;
  externalId: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  reference: ReferenceQuantity;
  nutrients: Nutrients;
  servings: FoodServing[];
}

/** Nutrients as a provider reports them: a value that is not stated is `null`, never 0. */
export type ExternalNutrients = { [K in keyof Nutrients]: number | null };

/**
 * A product as an external food database returns it, before the user reviewed it. Missing
 * values stay missing (`null`) – a missing fat value does not mean 0 g fat.
 */
export interface ExternalProduct {
  provider: string;
  externalId: string;
  /** May be empty when the database has no name; the user has to enter one. */
  name: string;
  brand: string | null;
  barcode: string | null;
  reference: ReferenceQuantity;
  nutrients: ExternalNutrients;
  servings: FoodServing[];
  /** Main values the provider does not state. */
  missing: MainNutrient[];
}

export interface FoodSearchOptions {
  limit: number;
  /** Language for product names, e.g. "de". */
  locale: string;
  signal?: AbortSignal;
}

export type FoodProviderErrorCode =
  /** No connection. */
  | 'offline'
  | 'timeout'
  /** Too many requests – the provider asks to wait. */
  | 'rate-limited'
  /** Server error or maintenance. */
  | 'unavailable'
  /** The answer could not be understood. */
  | 'invalid-response';

/** A provider request failed; local foods stay fully usable. */
export class FoodProviderError extends Error {
  constructor(readonly code: FoodProviderErrorCode) {
    super(`Food provider request failed: ${code}`);
    this.name = 'FoodProviderError';
  }
}

/**
 * Contract for an external food data source (search, barcode, product lookup). The rest of the
 * nutrition module never depends on a concrete provider.
 *
 * Privacy rule: a provider receives only the search text, the barcode or the product id –
 * never diary entries, goals, weight, profile or training data. The method signatures make
 * anything else impossible to pass.
 */
export interface FoodDataProvider {
  readonly id: string;
  /** Name shown as data source, e.g. "Open Food Facts". */
  readonly displayName: string;
  /** Full-text search; an empty or too short query returns [] without a request. */
  search(query: string, options: FoodSearchOptions): Promise<ExternalProduct[]>;
  /** `null` when the barcode is unknown. */
  lookupBarcode(
    barcode: string,
    options?: { signal?: AbortSignal },
  ): Promise<ExternalProduct | null>;
  getProduct(
    externalId: string,
    options?: { signal?: AbortSignal },
  ): Promise<ExternalProduct | null>;
}
