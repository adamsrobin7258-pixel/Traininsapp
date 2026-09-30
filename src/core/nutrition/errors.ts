export type NutritionErrorCode =
  | 'not-found'
  | 'invalid-name'
  | 'invalid-value'
  | 'invalid-unit'
  | 'incompatible-unit'
  | 'food-inactive'
  | 'last-meal';

/** Rejected nutrition operation; the code is translated by the UI. */
export class NutritionError extends Error {
  constructor(readonly code: NutritionErrorCode) {
    super(`Nutrition operation rejected: ${code}`);
    this.name = 'NutritionError';
  }
}
