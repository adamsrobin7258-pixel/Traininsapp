import type { Nutrients } from './nutrients';
import type { FoodServing, ReferenceQuantity } from './food';

/**
 * A product as an external food database returns it, before it is stored locally.
 * Contains food data only – never personal data.
 */
export interface ExternalFood {
  /** Identifier of the provider, e.g. "openfoodfacts" (chosen in a later phase). */
  provider: string;
  externalId: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  reference: ReferenceQuantity;
  nutrients: Nutrients;
  servings: FoodServing[];
}

export interface FoodSearchOptions {
  limit: number;
  /** Language for product names, e.g. "de". */
  locale: string;
}

/**
 * Contract for an external food data source (search, barcode, product lookup). No
 * implementation exists yet; the rest of the nutrition module never depends on a concrete
 * provider. Privacy rule: a provider receives only the search text, the barcode or the
 * product id – never diary entries, goals, weight or profile data.
 */
export interface FoodDataProvider {
  readonly id: string;
  search(query: string, options: FoodSearchOptions): Promise<ExternalFood[]>;
  lookupBarcode(barcode: string): Promise<ExternalFood | null>;
  getProduct(externalId: string): Promise<ExternalFood | null>;
}
