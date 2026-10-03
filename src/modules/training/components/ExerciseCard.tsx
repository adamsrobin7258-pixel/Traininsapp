import { useState, type CSSProperties } from 'react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import {
  EMPTY_SET_VALUES,
  exerciseDisplayName,
  groupSets,
  setFieldsFor,
  useTraining,
  useTrainingData,
  type Exercise,
  type WorkoutExerciseWithSets,
  type WorkoutSet,
} from '@/core/training';
import { ConfirmSheet, dismissKeyboard, Icon } from '@/ui';
import { describeTrainingError } from '../domain/errors';
import { formatLoad, formatSetShort } from '../domain/format';
import { headerKey, type EntryField } from '../domain/setFields';
import { ExercisePicker } from './ExercisePicker';
import { SetOptionsSheet } from './SetOptionsSheet';
import { SetRow } from './SetRow';
import styles from './ExerciseCard.module.css';

interface ExerciseCardProps {
  exercise: WorkoutExerciseWithSets;
  index: number;
  count: number;
  /** The workout is in progress: suggestions are offered (not when editing history). */
  live: boolean;
}

interface SetNames {
  label: string;
  badge: string;
  complete: string;
  reopen: string;
}

/**
 * One exercise of a workout: warm-ups, working sets with their drops, the last performance, an
 * optional weight increase suggestion and quick actions. Set types are shown by a small marker
 * (tap it for type and delete) and, with warm-ups, by group captions.
 */
export function ExerciseCard({ exercise, index, count, live }: ExerciseCardProps) {
  const { t, locale } = useI18n();
  const { weightUnit: unit, progressionMode } = useSettings().settings;
  const { mutate } = useTraining();
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState<Exercise | null>(null);
  const [options, setOptions] = useState<{ set: WorkoutSet; label: string } | null>(null);
  const name = exerciseDisplayName(exercise, locale);
  const fields = setFieldsFor(exercise.exerciseType).filter(
    (field): field is EntryField => field !== 'rpe',
  );
  const lastSet = exercise.sets.at(-1);
  const { warmups, working } = groupSets(exercise.sets);
  const lastWorking = working.at(-1)?.set;

  const last = useTrainingData(
    (s, profileId) =>
      exercise.exerciseId
        ? s.workouts.lastPerformance(profileId, exercise.exerciseId, exercise.workoutId)
        : Promise.resolve(null),
    [exercise.exerciseId, exercise.workoutId],
  );
  // The last real performance: working sets with their drops (warm-ups only prepare).
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

  function run(change: Parameters<typeof mutate>[0]) {
    // A still-focused set field saves first (blur), then this change runs.
    dismissKeyboard();
    setError(null);
    mutate(change).catch((failure: unknown) => {
      setError(describeTrainingError(failure, t, unit, locale));
    });
  }

  const row = (set: WorkoutSet, names: SetNames) => (
    <SetRow
      key={set.id}
      set={set}
      label={names.label}
      badge={names.badge}
      completeLabel={names.complete}
      reopenLabel={names.reopen}
      exerciseType={exercise.exerciseType}
      optionsLabel={t('training.workout.setOptions', { label: names.label })}
      onOptions={() => {
        setOptions({ set, label: names.label });
      }}
    />
  );

  function replaceWith(next: Exercise) {
    // Another kind of exercise gets new sets: ask first when values were already logged.
    if (next.exerciseType !== exercise.exerciseType && exercise.sets.some((set) => set.completed)) {
      setConfirmReplace(next);
      return;
    }
    run((s, profileId) => s.workouts.replaceExercise(profileId, exercise.id, next.id));
  }

  const warmupNames = (number: number): SetNames => ({
    label: t('training.workout.warmupNumber', { number }),
    badge: t('training.workout.warmupBadge', { number }),
    complete: t('training.workout.completeWarmup', { number }),
    reopen: t('training.workout.reopenWarmup', { number }),
  });
  const workingNames = (number: number): SetNames => ({
    label: t('training.workout.setNumber', { number }),
    badge: String(number),
    complete: t('training.workout.completeSet', { number }),
    reopen: t('training.workout.reopenSet', { number }),
  });
  const dropNames = (number: number, drop: number): SetNames => ({
    label: t('training.workout.dropNumber', { number, drop }),
    badge: t('training.workout.dropBadge'),
    complete: t('training.workout.completeDrop', { number, drop }),
    reopen: t('training.workout.reopenDrop', { number, drop }),
  });

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
              className={styles.addSet}
              aria-label={t('training.workout.suggestionApplyLabel', {
                value: t('training.workout.suggestionValue', {
                  load: formatLoad(suggested.weightKg, unit, locale),
                  reps: suggested.reps,
                }),
                name,
              })}
              onClick={() => {
                // Fills the open working sets – nothing is completed, everything stays editable.
                run(async (s, profileId) => {
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

      {warmups.length > 0 ? (
        <div className={styles.group} role="group" aria-label={t('training.workout.warmupsTitle')}>
          <p className={styles.groupTitle} aria-hidden="true">
            {t('training.workout.warmupsTitle')}
          </p>
          <div className={styles.sets}>{warmups.map((set, i) => row(set, warmupNames(i + 1)))}</div>
        </div>
      ) : null}

      <div
        className={styles.group}
        role="group"
        aria-label={warmups.length > 0 ? t('training.workout.workingTitle') : undefined}
      >
        {warmups.length > 0 ? (
          <p className={styles.groupTitle} aria-hidden="true">
            {t('training.workout.workingTitle')}
          </p>
        ) : null}
        <div className={styles.sets}>
          {working.map((group, i) => [
            row(group.set, workingNames(i + 1)),
            ...group.drops.map((drop, d) => row(drop, dropNames(i + 1, d + 1))),
          ])}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.adds}>
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
          <button
            type="button"
            className={styles.addOther}
            aria-label={t('training.workout.addWarmupLabel')}
            onClick={() => {
              run((s, profileId) => s.workouts.addSet(profileId, exercise.id, 'warmup'));
            }}
          >
            <Icon name="plus" size={16} />
            {t('training.workout.addWarmup')}
          </button>
          {lastWorking ? (
            <button
              type="button"
              className={styles.addOther}
              aria-label={t('training.workout.addDropLabel')}
              onClick={() => {
                run((s, profileId) => s.workouts.addDrop(profileId, lastWorking.id));
              }}
            >
              <Icon name="plus" size={16} />
              {t('training.workout.addDrop')}
            </button>
          ) : null}
        </div>
        <div className={styles.adds}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              dismissKeyboard();
              setReplacing(true);
            }}
          >
            <Icon name="swap" size={16} />
            {t('training.workout.replaceExercise')}
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
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {replacing ? (
        <ExercisePicker
          title={t('training.workout.replaceTitle')}
          note={live ? t('training.workout.replaceNote') : undefined}
          onPick={(next) => {
            setReplacing(false);
            replaceWith(next);
            return Promise.resolve();
          }}
          onClose={() => {
            setReplacing(false);
          }}
        />
      ) : null}
      {confirmReplace ? (
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
              s.workouts.replaceExercise(profileId, exercise.id, confirmReplace.id),
            );
          }}
          onClose={() => {
            setConfirmReplace(null);
          }}
        />
      ) : null}
      {options ? (
        <SetOptionsSheet
          set={options.set}
          sets={exercise.sets}
          label={options.label}
          onClose={() => {
            setOptions(null);
          }}
        />
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
