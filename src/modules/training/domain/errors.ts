import type { TranslateFn, TranslationKey } from '@/core/i18n';
import { SET_LIMITS, TrainingError, WEIGHT_INPUT_DECIMALS, type SetError } from '@/core/training';
import { fromKg, type WeightUnit } from '@/shared/lib/units';

const FIELD_MESSAGES: Record<SetError['field'], TranslationKey> = {
  weightKg: 'training.errors.weight',
  reps: 'training.errors.reps',
  rpe: 'training.errors.rpe',
  durationS: 'training.errors.duration',
  distanceM: 'training.errors.distance',
};

/** Explains a set problem; "required" gets one combined message. */
export function describeSetError(
  error: SetError,
  t: TranslateFn,
  unit: WeightUnit,
  locale: string,
): string {
  if (error.problem === 'required') return t('training.errors.required');
  const max = new Intl.NumberFormat(locale, {
    maximumFractionDigits: WEIGHT_INPUT_DECIMALS,
  }).format(Math.floor(fromKg(SET_LIMITS.weightKg.max, unit)));
  return t(FIELD_MESSAGES[error.field], { max, unit });
}

const CODE_MESSAGES: Partial<Record<TrainingError['code'], TranslationKey>> = {
  'invalid-name': 'training.errors.invalidName',
  'invalid-value': 'training.errors.targets',
  'active-workout-exists': 'training.workout.alreadyActive',
  'empty-plan-day': 'training.errors.emptyDay',
  'exercise-inactive': 'training.errors.inactive',
  'not-found': 'training.errors.notFound',
};

/** Message for any failure of a training action; unknown failures are storage errors. */
export function describeTrainingError(
  error: unknown,
  t: TranslateFn,
  unit: WeightUnit,
  locale: string,
): string {
  if (error instanceof TrainingError) {
    const [first] = error.setErrors;
    if (first) return describeSetError(first, t, unit, locale);
    const key = CODE_MESSAGES[error.code];
    if (key) return t(key);
  }
  return t('training.errors.saveFailed');
}
