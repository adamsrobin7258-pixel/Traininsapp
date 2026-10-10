import { useState } from 'react';
import { useI18n } from '@/core/i18n';
import {
  exerciseDisplayName,
  useTraining,
  type Exercise,
  type TrainingServices,
  type WorkoutExerciseWithSets,
} from '@/core/training';
import { ConfirmSheet } from '@/ui';
import { ExercisePicker } from './ExercisePicker';

type Change = (services: TrainingServices, profileId: string) => Promise<unknown>;

/**
 * Replacing an exercise of this workout only (`WorkoutService.replaceExercise` – the plan is
 * never changed): the picker, and a confirmation when another kind of exercise would drop
 * values that were already logged.
 */
export function ReplaceExercise({
  exercise,
  live,
  onChange,
  onClose,
}: {
  exercise: WorkoutExerciseWithSets;
  live: boolean;
  /** Runs a change with the caller's error handling. */
  onChange: (change: Change) => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { mutate } = useTraining();
  const [confirm, setConfirm] = useState<Exercise | null>(null);
  const name = exerciseDisplayName(exercise, locale);

  if (confirm) {
    return (
      <ConfirmSheet
        title={t('training.workout.confirmReplaceTitle')}
        body={t('training.workout.confirmReplaceBody', { name })}
        confirmLabel={t('training.workout.replaceExercise')}
        cancelLabel={t('common.cancel')}
        closeLabel={t('common.close')}
        errorText={t('training.errors.saveFailed')}
        destructive
        onConfirm={async () => {
          await mutate((s, profileId) =>
            s.workouts.replaceExercise(profileId, exercise.id, confirm.id),
          );
          onClose();
        }}
        onClose={onClose}
      />
    );
  }
  return (
    <ExercisePicker
      title={t('training.workout.replaceTitle')}
      note={live ? t('training.workout.replaceNote') : undefined}
      onPick={(next) => {
        // Another kind of exercise gets new sets: ask first when values were already logged.
        if (
          next.exerciseType !== exercise.exerciseType &&
          exercise.sets.some((set) => set.completed)
        ) {
          setConfirm(next);
        } else {
          onClose();
          onChange((s, profileId) => s.workouts.replaceExercise(profileId, exercise.id, next.id));
        }
        return Promise.resolve();
      }}
      onClose={onClose}
    />
  );
}
