import { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { useTraining, type WorkoutDetail } from '@/core/training';
import { Button } from '@/ui';
import { describeTrainingError } from '../domain/errors';
import { ExerciseCard } from './ExerciseCard';
import { ExercisePicker } from './ExercisePicker';
import styles from './WorkoutEditor.module.css';

/** Exercises and sets of a workout; used while training and when editing a finished one. */
export function WorkoutEditor({ workout }: { workout: WorkoutDetail }) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const { mutate } = useTraining();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={styles.editor}>
      {workout.exercises.length === 0 ? (
        <p className={styles.empty}>{t('training.workout.noExercises')}</p>
      ) : null}
      {workout.exercises.map((exercise, index) => (
        <ExerciseCard
          key={exercise.id}
          exercise={exercise}
          index={index}
          count={workout.exercises.length}
          live={workout.status === 'active'}
        />
      ))}
      <Button
        variant="secondary"
        fullWidth
        onClick={() => {
          setPicking(true);
        }}
      >
        {t('training.workout.addExercise')}
      </Button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {picking ? (
        <ExercisePicker
          onPick={async (exercise) => {
            try {
              await mutate((s, profileId) =>
                s.workouts.addExercise(profileId, workout.id, exercise.id),
              );
              setError(null);
            } catch (failure) {
              setError(describeTrainingError(failure, t, unit, locale));
            }
            setPicking(false);
          }}
          onClose={() => {
            setPicking(false);
          }}
        />
      ) : null}
    </div>
  );
}
