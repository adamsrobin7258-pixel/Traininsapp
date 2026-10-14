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
  /**
   * Shops the product is sold in, when the provider states them (online search only, e.g.
   * "Lidl"). Used to rank "Quark Lidl"; never stored.
   */
  stores?: string[];
  /**
   * Search only (Phase 28), never stored: the provider's categories, normalised to plain words
   * ("fresh cheeses") – they tell the ranking what kind of food a product is.
   */
  categories?: string[];
  /** Search only: the stated package size, normalised ("500 g"); tells variants apart. */
  packageSize?: string | null;
  /** Search only: what the provider itself says about the quality of its record. */
  qualitySignals?: ProductQualitySignals;
}

/**
 * Quality indicators a provider states for a record (Open Food Facts: completeness, quality
 * errors and warnings, states). Indicators only – they say nothing about whether the values
 * are *correct*, and the app never presents a product as verified because of them.
 */
export interface ProductQualitySignals {
  /** 0–1, how many of the provider's fields are filled; `null` when not stated. */
  completeness: number | null;
  /** Errors the provider detected in the record (e.g. energy does not match the nutrients). */
  errors: string[];
  /** Warnings the provider detected (only those about nutrition values matter here). */
  warnings: string[];
  /** The provider marks the nutrition facts as completed; `null` when not stated. */
  nutritionComplete: boolean | null;
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
 * Contract for an external food data source (barcode and product lookup, optionally a product
 * search). The rest of the nutrition module never depends on a concrete provider. The normal
 * search stays offline (own foods, saved products and the bundled BLS); `searchProducts` is
 * only used when the user explicitly asks for more products online (Phase 27).
 *
 * Privacy rule: a provider receives only the barcode, the product id or the search text –
 * never diary entries, goals, weight, profile, usage or training data. The method signatures
 * make anything else impossible to pass.
 */
export interface FoodDataProvider {
  readonly id: string;
  /** Name shown as data source, e.g. "Open Food Facts". */
  readonly displayName: string;
  /** `null` when the barcode is unknown. */
  lookupBarcode(
    barcode: string,
    options?: { signal?: AbortSignal },
  ): Promise<ExternalProduct | null>;
  getProduct(
    externalId: string,
    options?: { signal?: AbortSignal },
  ): Promise<ExternalProduct | null>;
  /**
   * Products for a search text, best matches of the provider first. Optional: a provider
   * without a search simply has no online extension.
   */
  searchProducts?(
    query: string,
    options: { limit: number; signal?: AbortSignal },
  ): Promise<ExternalProduct[]>;
}
