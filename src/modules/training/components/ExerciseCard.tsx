import { useState, type CSSProperties } from 'react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import {
  exerciseDisplayName,
  groupSets,
  setFieldsFor,
  useTraining,
  type WorkoutExerciseWithSets,
  type WorkoutSet,
} from '@/core/training';
import { ConfirmSheet, dismissKeyboard, Icon } from '@/ui';
import { describeTrainingError } from '../domain/errors';
import { headerKey, type EntryField } from '../domain/setFields';
import { ExerciseHints } from './ExerciseHints';
import { ReplaceExercise } from './ReplaceExercise';
import { SetOptionsSheet } from './SetOptionsSheet';
import { SetRow } from './SetRow';
import styles from './ExerciseCard.module.css';

interface ExerciseCardProps {
  exercise: WorkoutExerciseWithSets;
  index: number;
  count: number;
  /** The workout is in progress: suggestions are offered (not when editing history). */
  live: boolean;
  /** Opens this exercise in the focus view (workout in progress only). */
  onOpen?: () => void;
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
export function ExerciseCard({ exercise, index, count, live, onOpen }: ExerciseCardProps) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const { mutate } = useTraining();
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [options, setOptions] = useState<{ set: WorkoutSet; label: string } | null>(null);
  const name = exerciseDisplayName(exercise, locale);
  const fields = setFieldsFor(exercise.exerciseType).filter(
    (field): field is EntryField => field !== 'rpe',
  );
  const lastSet = exercise.sets.at(-1);
  const { warmups, working } = groupSets(exercise.sets);
  const lastWorking = working.at(-1)?.set;

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
        <h3 className={styles.name}>
          {onOpen ? (
            <button
              type="button"
              className={styles.open}
              aria-label={t('training.focus.openExercise', { name })}
              onClick={() => {
                dismissKeyboard();
                onOpen();
              }}
            >
              {name}
              <Icon name="chevronRight" size={18} />
            </button>
          ) : (
            name
          )}
        </h3>
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

      <ExerciseHints exercise={exercise} live={live} onChange={run} />

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
        <ReplaceExercise
          exercise={exercise}
          live={live}
          onChange={run}
          onClose={() => {
            setReplacing(false);
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
