import type { TranslateFn, TranslationKey } from '@/core/i18n';
import {
  FoodProviderError,
  mealDisplayName,
  NutritionError,
  type DefaultMealKey,
  type Food,
  type MealSlot,
  type NutritionErrorCode,
  type QuantityUnit,
} from '@/core/nutrition';
import type { AmountError } from './input';

/** Whole kcal, e.g. "1.250 kcal". */
export function formatKcal(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)} kcal`;
}

/** Grams with at most one decimal, e.g. "12,5 g". */
export function formatGrams(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} g`;
}

/** Water: millilitres below one litre, litres above, e.g. "750 ml", "1,5 l". */
export function formatWater(ml: number, locale: string): string {
  if (ml >= 1000) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(ml / 1000)} l`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(ml)} ml`;
}

/** "150 g", "2 Stück", "1 Portion". */
export function formatQuantity(
  amount: number,
  unit: QuantityUnit,
  t: TranslateFn,
  locale: string,
): string {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount);
  return `${number} ${t(`nutrition.units.${unit}`)}`;
}

export function mealName(meal: Pick<MealSlot, 'defaultKey' | 'name'>, t: TranslateFn): string {
  return (
    mealDisplayName(meal, (key: DefaultMealKey) => t(`nutrition.meals.${key}`)) ||
    t('nutrition.meals.unassigned')
  );
}

const ERRORS: Record<NutritionErrorCode, TranslationKey> = {
  'not-found': 'nutrition.errors.notFound',
  'invalid-name': 'nutrition.errors.name',
  'invalid-value': 'nutrition.errors.invalidNumber',
  'invalid-unit': 'nutrition.errors.incompatibleUnit',
  'incompatible-unit': 'nutrition.errors.incompatibleUnit',
  'food-inactive': 'nutrition.errors.foodInactive',
  'last-meal': 'nutrition.errors.lastMeal',
  'invalid-barcode': 'nutrition.errors.barcode',
};

/** User-facing text for a failed nutrition action (never the technical message). */
export function describeNutritionError(error: unknown, t: TranslateFn): string {
  if (error instanceof FoodProviderError) return t(`nutrition.lookup.errors.${error.code}`);
  return t(error instanceof NutritionError ? ERRORS[error.code] : 'nutrition.errors.saveFailed');
}

const AMOUNT_ERRORS: Record<AmountError, TranslationKey> = {
  empty: 'nutrition.errors.required',
  invalid: 'nutrition.errors.invalidNumber',
  negative: 'nutrition.errors.negative',
  range: 'nutrition.errors.amount',
};

export function describeAmountError(error: AmountError, t: TranslateFn): string {
  return t(AMOUNT_ERRORS[error]);
}

/** BLS foods are reference data: shown read-only, edited only as an own copy. */
export function isReferenceFood(food: Pick<Food, 'origin'>): boolean {
  return food.origin !== null;
}

/** Where a food comes from: "BLS 4.0", "Open Food Facts", "Eigenes" or "Eigene Kopie". */
export function foodSourceLabel(
  food: Pick<Food, 'source' | 'origin' | 'copiedFromId'>,
  t: TranslateFn,
): string {
  if (food.origin) return t('nutrition.sources.bls', { version: food.origin.version });
  if (food.source === 'external') return t('nutrition.sources.openFoodFacts');
  return t(food.copiedFromId ? 'nutrition.sources.copy' : 'nutrition.sources.own');
}

/** Required attribution of a food's data source, if it has one. */
export function foodAttribution(
  food: Pick<Food, 'source' | 'origin'>,
  t: TranslateFn,
): string | null {
  if (food.origin) return t('nutrition.sources.blsAttribution', { version: food.origin.version });
  if (food.source === 'external') return t('nutrition.lookup.attribution');
  return null;
}
