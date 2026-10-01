import type { TranslateFn, TranslationKey } from '@/core/i18n';
import {
  mealDisplayName,
  NutritionError,
  type DefaultMealKey,
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
};

/** User-facing text for a failed nutrition action (never the technical message). */
export function describeNutritionError(error: unknown, t: TranslateFn): string {
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
