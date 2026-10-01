import { NutritionError } from './errors';
import { scaleNutrients, type Nutrients } from './nutrients';
import {
  convertQuantity,
  isCountUnit,
  type CountUnit,
  type MeasureUnit,
  type QuantityUnit,
} from './units';

/**
 * Where a food's data comes from – deliberately abstract, no provider is built in:
 * - `custom`: created by the user,
 * - `local`: shipped with the app (reference data, no profile),
 * - `external`: copied from an external food database; `provider` names it (e.g. later
 *   "openfoodfacts") and `externalId` identifies the product there. Stored locally, so it
 *   works offline afterwards.
 */
export const FOOD_SOURCES = ['custom', 'local', 'external'] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

/** Nutrients are stated for this amount, e.g. 100 g, 100 ml, 1 piece or 1 serving. */
export interface ReferenceQuantity {
  amount: number;
  unit: QuantityUnit;
}

/**
 * Food-specific size of a piece or serving, e.g. "1 piece = 120 g" for a banana. This is the
 * only way pieces and servings convert to weight or volume.
 */
export interface FoodServing {
  unit: CountUnit;
  amount: number;
  amountUnit: MeasureUnit;
  /** Optional wording, e.g. "1 Riegel". */
  label: string | null;
}

export interface Food {
  id: string;
  /** Owner; `null` only for app-provided (`local`) foods. */
  profileId: string | null;
  source: FoodSource;
  provider: string | null;
  externalId: string | null;
  name: string;
  brand: string | null;
  barcode: string | null;
  reference: ReferenceQuantity;
  nutrients: Nutrients;
  servings: FoodServing[];
  favorite: boolean;
  /** Foods are never deleted (templates and recipes refer to them), only deactivated. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const FOOD_NAME_MAX_LENGTH = 120;

/** How many recently used foods are offered for quick re-use. */
export const RECENT_FOODS_LIMIT = 30;

/** Reference amounts are positive and plausible (up to 10 kg / 10 l / 1000 pieces). */
export function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 10_000;
}

/**
 * Expresses `amount unit` in the food's reference unit, using its serving definitions for
 * pieces and servings. Returns `null` when that is not possible (e.g. grams of a food only
 * defined per piece without a piece weight, or grams of a drink stated per 100 ml).
 */
export function toReferenceAmount(
  food: Pick<Food, 'reference' | 'servings'>,
  amount: number,
  unit: QuantityUnit,
): number | null {
  const target = food.reference.unit;
  const direct = convertQuantity(amount, unit, target);
  if (direct !== null) return direct;

  const serving = (countUnit: CountUnit) => food.servings.find((s) => s.unit === countUnit);
  // Pieces/servings → the reference's weight or volume via the food's serving size.
  if (isCountUnit(unit)) {
    const size = serving(unit);
    return size ? convertQuantity(amount * size.amount, size.amountUnit, target) : null;
  }
  // Weight/volume → a reference stated per piece or serving.
  if (isCountUnit(target)) {
    const size = serving(target);
    const measured = size ? convertQuantity(amount, unit, size.amountUnit) : null;
    return size && measured !== null ? measured / size.amount : null;
  }
  return null;
}

/**
 * Nutrients of an eaten or planned quantity: the food's values scaled from its reference
 * quantity. Deterministic and independent of the UI; e.g. 150 g of a food with 200 kcal per
 * 100 g gives 300 kcal.
 */
export function nutrientsForQuantity(
  food: Pick<Food, 'reference' | 'servings' | 'nutrients'>,
  amount: number,
  unit: QuantityUnit,
): Nutrients {
  if (!isValidAmount(amount)) throw new NutritionError('invalid-value');
  const inReference = toReferenceAmount(food, amount, unit);
  if (inReference === null) throw new NutritionError('incompatible-unit');
  return scaleNutrients(food.nutrients, inReference / food.reference.amount);
}

/** Units a quantity of this food can be entered in. */
export function unitsFor(food: Pick<Food, 'reference' | 'servings'>): QuantityUnit[] {
  const candidates: QuantityUnit[] = ['g', 'kg', 'ml', 'l', 'piece', 'serving'];
  return candidates.filter((unit) => toReferenceAmount(food, 1, unit) !== null);
}

const searchText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Local food search: every word of the query must appear in the name or the brand, ignoring
 * case and accents ("muller joghurt" finds "Joghurt" by "Müller"). An empty query matches all.
 */
export function matchesFoodSearch(food: Pick<Food, 'name' | 'brand'>, query: string): boolean {
  const words = searchText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = searchText(`${food.name} ${food.brand ?? ''}`);
  return words.every((word) => haystack.includes(word));
}
