import { useState, type CSSProperties } from 'react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import {
  exerciseDisplayName,
  setFieldsFor,
  useTraining,
  useTrainingData,
  type WorkoutExerciseWithSets,
} from '@/core/training';
import { ConfirmSheet, Icon } from '@/ui';
import { describeTrainingError } from '../domain/errors';
import { formatSetShort } from '../domain/format';
import { headerKey } from '../domain/setFields';
import { SetRow } from './SetRow';
import styles from './ExerciseCard.module.css';

interface ExerciseCardProps {
  exercise: WorkoutExerciseWithSets;
  index: number;
  count: number;
}

/** One exercise of a workout: sets table, last performance and quick actions. */
export function ExerciseCard({ exercise, index, count }: ExerciseCardProps) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const { mutate } = useTraining();
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const name = exerciseDisplayName(exercise, locale);
  const fields = setFieldsFor(exercise.exerciseType);
  const lastSet = exercise.sets.at(-1);

  const last = useTrainingData(
    (s, profileId) =>
      exercise.exerciseId
        ? s.workouts.lastPerformance(profileId, exercise.exerciseId, exercise.workoutId)
        : Promise.resolve(null),
    [exercise.exerciseId, exercise.workoutId],
  );

  function run(change: Parameters<typeof mutate>[0]) {
    setError(null);
    mutate(change).catch((failure: unknown) => {
      setError(describeTrainingError(failure, t, unit, locale));
    });
  }

  return (
    <article className={styles.card} aria-label={name}>
      <header className={styles.header}>
        <h3 className={styles.name}>{name}</h3>
        <div className={styles.tools}>
          <button
            type="button"
            className={styles.tool}
            aria-label={t('training.workout.moveUp')}
            disabled={index === 0}
            onClick={() => {
              run((s, profileId) => s.workouts.moveExercise(profileId, exercise.id, -1));
            }}
          >
            <Icon name="arrowUp" size={18} />
          </button>
          <button
            type="button"
            className={styles.tool}
            aria-label={t('training.workout.moveDown')}
            disabled={index === count - 1}
            onClick={() => {
              run((s, profileId) => s.workouts.moveExercise(profileId, exercise.id, 1));
            }}
          >
            <Icon name="arrowDown" size={18} />
          </button>
          <button
            type="button"
            className={styles.tool}
            aria-label={t('training.workout.removeExercise')}
            onClick={() => {
              setConfirmRemove(true);
            }}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      </header>

      {last.status === 'ready' && last.data ? (
        <p className={styles.last}>
          {t('training.workout.lastTime', {
            sets: last.data.sets
              .map((set) => formatSetShort(set, exercise.exerciseType, unit, locale))
              .join(' · '),
          })}
        </p>
      ) : null}

      <div
        className={styles.head}
        style={{ '--fields': fields.length } as CSSProperties}
        aria-hidden="true"
      >
        <span>{t('training.workout.setHeader')}</span>
        {fields.map((field) => (
          <span key={field}>{t(headerKey(field, exercise.exerciseType))}</span>
        ))}
        <span />
      </div>
      <div className={styles.sets}>
        {exercise.sets.map((set, setIndex) => (
          <SetRow
            key={set.id}
            set={set}
            number={setIndex + 1}
            exerciseType={exercise.exerciseType}
          />
        ))}
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.addSet}
          aria-label={t('training.workout.addSetLabel')}
          onClick={() => {
            run((s, profileId) => s.workouts.addSet(profileId, exercise.id));
          }}
        >
          <Icon name="plus" size={18} />
          {t('training.workout.addSet')}
        </button>
        {lastSet ? (
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              run((s, profileId) => s.workouts.deleteSet(profileId, lastSet.id));
            }}
          >
            {t('training.workout.removeLastSet')}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {confirmRemove ? (
        <ConfirmSheet
          title={t('training.workout.confirmRemoveExerciseTitle')}
          body={t('training.workout.confirmRemoveExerciseBody', { name })}
          confirmLabel={t('training.workout.removeExercise')}
          cancelLabel={t('common.cancel')}
          closeLabel={t('common.close')}
          errorText={t('training.errors.saveFailed')}
          destructive
          onConfirm={async () => {
            await mutate((s, profileId) => s.workouts.removeExercise(profileId, exercise.id));
          }}
          onClose={() => {
            setConfirmRemove(false);
          }}
        />
      ) : null}
    </article>
  );
}
