import type { SetError } from './sets';

export type TrainingErrorCode =
  | 'not-found'
  | 'invalid-name'
  | 'invalid-value'
  | 'invalid-set'
  | 'unknown-training-type'
  | 'unavailable-training-type'
  | 'active-workout-exists'
  | 'workout-not-active'
  | 'exercise-inactive'
  | 'empty-plan-day';

/** A rule violation the UI can explain. Storage failures surface as other errors. */
export class TrainingError extends Error {
  constructor(
    readonly code: TrainingErrorCode,
    readonly setErrors: SetError[] = [],
  ) {
    super(`Training operation rejected: ${code}`);
    this.name = 'TrainingError';
  }
}
