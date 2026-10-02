export type NutritionErrorCode =
  | 'not-found'
  | 'invalid-name'
  | 'invalid-value'
  | 'invalid-unit'
  | 'incompatible-unit'
  | 'food-inactive'
  | 'last-meal'
  | 'invalid-barcode';

/** Rejected nutrition operation; the code is translated by the UI. */
export class NutritionError extends Error {
  constructor(readonly code: NutritionErrorCode) {
    super(`Nutrition operation rejected: ${code}`);
    this.name = 'NutritionError';
  }
}

const ERROR_KEYS = {
  'not-found': 'nutrition.errors.notFound',
  'invalid-name': 'nutrition.errors.name',
  'invalid-value': 'nutrition.errors.invalidNumber',
  'invalid-unit': 'nutrition.errors.incompatibleUnit',
  'incompatible-unit': 'nutrition.errors.incompatibleUnit',
  'food-inactive': 'nutrition.errors.foodInactive',
  'last-meal': 'nutrition.errors.lastMeal',
  'invalid-barcode': 'nutrition.errors.barcode',
} as const satisfies Record<NutritionErrorCode, string>;

/** Translation key for a failed nutrition action – shared by every area that saves goals. */
export function nutritionErrorKey(
  error: unknown,
): (typeof ERROR_KEYS)[NutritionErrorCode] | 'nutrition.errors.saveFailed' {
  return error instanceof NutritionError ? ERROR_KEYS[error.code] : 'nutrition.errors.saveFailed';
}
