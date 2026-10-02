import type { TranslateFn, TranslationKey } from '@/core/i18n';
import {
  FoodProviderError,
  mealDisplayName,
  nutritionErrorKey,
  type DefaultMealKey,
  type Food,
  type MealSlot,
  type QuantityUnit,
} from '@/core/nutrition';
import type { AmountError } from './input';

export { formatGrams, formatKcal, formatWater } from '@/shared/lib/format';

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

/** User-facing text for a failed nutrition action (never the technical message). */
export function describeNutritionError(error: unknown, t: TranslateFn): string {
  if (error instanceof FoodProviderError) return t(`nutrition.lookup.errors.${error.code}`);
  return t(nutritionErrorKey(error));
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
