import type { TranslationKey } from '@/core/i18n';
import type { ExerciseType, SetValues } from '@/core/training';

const HEADERS: Record<keyof SetValues, TranslationKey> = {
  weightKg: 'training.workout.weightHeader',
  reps: 'training.workout.repsHeader',
  rpe: 'training.workout.rpeHeader',
  durationS: 'training.workout.durationHeader',
  distanceM: 'training.workout.distanceHeader',
};

export function headerKey(field: keyof SetValues, type: ExerciseType): TranslationKey {
  return field === 'weightKg' && type === 'bodyweight'
    ? 'training.workout.addedWeightHeader'
    : HEADERS[field];
}
