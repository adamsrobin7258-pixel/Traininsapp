import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import {
  EMPTY_SET_VALUES,
  exerciseDisplayName,
  groupSets,
  useTrainingData,
  type TrainingServices,
  type WorkoutExerciseWithSets,
} from '@/core/training';
import { formatLoad, formatSetShort } from '../domain/format';
import styles from './ExerciseHints.module.css';

type Change = (services: TrainingServices, profileId: string) => Promise<unknown>;

/**
 * What helps choosing the values of an exercise: its last real performance (working sets with
 * their drops – warm-ups only prepare) and, while training, a weight increase suggestion that
 * can be taken over into the open working sets. Nothing is ever completed by it.
 */
export function ExerciseHints({
  exercise,
  live,
  onChange,
}: {
  exercise: WorkoutExerciseWithSets;
  /** The workout is in progress: suggestions are offered (not when editing history). */
  live: boolean;
  /** Runs a change with the caller's error handling. */
  onChange: (change: Change) => void;
}) {
  const { t, locale } = useI18n();
  const { weightUnit: unit, progressionMode } = useSettings().settings;
  const name = exerciseDisplayName(exercise, locale);
  const { working } = groupSets(exercise.sets);

  const last = useTrainingData(
    (s, profileId) =>
      exercise.exerciseId
        ? s.workouts.lastPerformance(profileId, exercise.exerciseId, exercise.workoutId)
        : Promise.resolve(null),
    [exercise.exerciseId, exercise.workoutId],
  );
  const lastGroups = last.status === 'ready' && last.data ? groupSets(last.data.sets).working : [];

  const suggestion = useTrainingData(
    (s, profileId) =>
      live && exercise.exerciseType === 'weighted'
        ? s.workouts.progression(profileId, exercise.id, progressionMode, unit)
        : Promise.resolve(null),
    [exercise.id, live, progressionMode, unit],
  );
  const suggested = suggestion.status === 'ready' ? suggestion.data : null;
  const openWorking = working.filter((group) => !group.set.completed).map((group) => group.set);
  const applied =
    suggested !== null &&
    openWorking.every((set) => set.weightKg === suggested.weightKg && set.reps === suggested.reps);

  if (lastGroups.length === 0 && !suggested) return null;
  return (
    <>
      {lastGroups.length > 0 ? (
        <section className={styles.last} aria-label={t('training.workout.lastListLabel')}>
          <h4 className={styles.lastTitle}>{t('training.workout.lastTitle')}</h4>
          <ol className={styles.lastList}>
            {lastGroups.map((group) => (
              <li key={group.set.id}>
                {[group.set, ...group.drops]
                  .map((set) => formatSetShort(set, exercise.exerciseType, unit, locale))
                  .join(' ↓ ')}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {suggested ? (
        <section className={styles.suggestion} aria-label={t('training.workout.suggestionTitle')}>
          <div className={styles.suggestionText}>
            <h4 className={styles.lastTitle}>{t('training.workout.suggestionTitle')}</h4>
            <p className={styles.suggestionValue}>
              {t('training.workout.suggestionValue', {
                load: formatLoad(suggested.weightKg, unit, locale),
                reps: suggested.reps,
              })}
            </p>
            <p className={styles.suggestionHint}>
              {t('training.workout.suggestionHint', {
                sessions: suggested.sessions,
                from: formatLoad(suggested.fromKg, unit, locale),
                target: suggested.fromReps,
              })}
            </p>
          </div>
          {!applied ? (
            <button
              type="button"
              className={styles.apply}
              aria-label={t('training.workout.suggestionApplyLabel', {
                value: t('training.workout.suggestionValue', {
                  load: formatLoad(suggested.weightKg, unit, locale),
                  reps: suggested.reps,
                }),
                name,
              })}
              onClick={() => {
                // Fills the open working sets – nothing is completed, everything stays editable.
                onChange(async (s, profileId) => {
                  for (const set of openWorking) {
                    await s.workouts.updateSet(
                      profileId,
                      set.id,
                      {
                        ...EMPTY_SET_VALUES,
                        weightKg: suggested.weightKg,
                        reps: suggested.reps,
                        rpe: set.rpe,
                      },
                      false,
                    );
                  }
                });
              }}
            >
              {t('training.workout.suggestionApply')}
            </button>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
