import type { TranslationKey } from '@/core/i18n';
import type { ExerciseType, SetValues } from '@/core/training';

/** Fields entered in the app (RPE is kept in stored data but no longer entered or shown). */
export type EntryField = Exclude<keyof SetValues, 'rpe'>;

const HEADERS: Record<EntryField, TranslationKey> = {
  weightKg: 'training.workout.weightHeader',
  reps: 'training.workout.repsHeader',
  durationS: 'training.workout.durationHeader',
  distanceM: 'training.workout.distanceHeader',
};

export function headerKey(field: EntryField, type: ExerciseType): TranslationKey {
  return field === 'weightKg' && type === 'bodyweight'
    ? 'training.workout.addedWeightHeader'
    : HEADERS[field];
}
