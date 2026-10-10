import { useEffect, useRef, useState } from 'react';
import { useI18n, type TranslateFn } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import {
  exerciseDisplayName,
  useTraining,
  type TrainingServices,
  type WorkoutDetail,
  type WorkoutExerciseWithSets,
} from '@/core/training';
import { formatDecimalInput } from '@/shared/lib/units';
import { Button, dismissKeyboard, Icon, Stepper } from '@/ui';
import { describeTrainingError } from '../domain/errors';
import {
  AUTO_FOCUS,
  nextPosition,
  positionAfter,
  setEntries,
  type FocusPosition,
  type FocusSelection,
  type SetEntry,
} from '../domain/focus';
import { formatSetShort } from '../domain/format';
import { headerKey } from '../domain/setFields';
import { isStepField, stepEntry, stepSize } from '../domain/stepper';
import { useSetDraft } from '../hooks/useSetDraft';
import { ExerciseHints } from './ExerciseHints';
import { ExercisePicker } from './ExercisePicker';
import { ReplaceExercise } from './ReplaceExercise';
import styles from './FocusWorkout.module.css';

/** After completing, the button is locked briefly: a double tap must not complete the next set. */
const COMPLETE_LOCK_MS = 500;

type Change<T> = (services: TrainingServices, profileId: string) => Promise<T>;

interface SetNames {
  label: string;
  badge: string;
  complete: string;
  reopen: string;
}

/** The same names as in the full list (ExerciseCard): "Satz 2", "A1", "Drop 1 zu Satz 3". */
function setNames(entry: SetEntry, t: TranslateFn): SetNames {
  const { number, drop } = entry;
  switch (entry.kind) {
    case 'warmup':
      return {
        label: t('training.workout.warmupNumber', { number }),
        badge: t('training.workout.warmupBadge', { number }),
        complete: t('training.workout.completeWarmup', { number }),
        reopen: t('training.workout.reopenWarmup', { number }),
      };
    case 'working':
      return {
        label: t('training.workout.setNumber', { number }),
        badge: String(number),
        complete: t('training.workout.completeSet', { number }),
        reopen: t('training.workout.reopenSet', { number }),
      };
    case 'drop':
      return {
        label: t('training.workout.dropNumber', { number, drop }),
        badge: t('training.workout.dropBadge'),
        complete: t('training.workout.completeDrop', { number, drop }),
        reopen: t('training.workout.reopenDrop', { number, drop }),
      };
  }
}

/**
 * The workout in progress, one exercise at a time: where it stands in the workout, the last
 * values and a suggestion, its sets in short form and the set being entered with large −/+
 * buttons. Completing a set saves it, starts the rest timer and prepares the next open set –
 * of this exercise, or of the next exercise once this one is done. No set is ever added
 * without the user asking for it.
 */
export function FocusWorkout({
  workout,
  selection,
  onSelect,
  onFinish,
}: {
  workout: WorkoutDetail;
  selection: FocusSelection;
  onSelect: (next: FocusSelection) => void;
  onFinish: () => void;
}) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const { mutate } = useTraining();
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'replace' | 'add' | null>(null);
  const [locked, setLocked] = useState(false);
  const lockTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(lockTimer.current);
    },
    [],
  );

  const exercises = workout.exercises;
  const done = new Set(selection.completedId ? [selection.completedId] : []);
  const auto = nextPosition(exercises, 0, done);
  const exercise =
    exercises.find((e) => e.id === selection.exerciseId) ??
    exercises.find((e) => e.id === auto?.exerciseId) ??
    exercises[0];

  async function run<T>(change: Change<T>): Promise<T | undefined> {
    // A still-focused field saves first (blur), then this change runs.
    dismissKeyboard();
    setError(null);
    try {
      return await mutate(change);
    } catch (failure) {
      setError(describeTrainingError(failure, t, unit, locale));
      return undefined;
    }
  }

  function select(position: Partial<FocusSelection>) {
    dismissKeyboard();
    onSelect({ ...AUTO_FOCUS, ...position });
  }

  const addExercise = (
    <>
      <Button
        variant="secondary"
        fullWidth
        onClick={() => {
          dismissKeyboard();
          setSheet('add');
        }}
      >
        {t('training.workout.addExercise')}
      </Button>
      {sheet === 'add' ? (
        <ExercisePicker
          onPick={async (picked) => {
            const id = await run((s, profileId) =>
              s.workouts.addExercise(profileId, workout.id, picked.id),
            );
            setSheet(null);
            if (id) select({ exerciseId: id });
          }}
          onClose={() => {
            setSheet(null);
          }}
        />
      ) : null}
    </>
  );

  if (!exercise) {
    return (
      <div className={styles.focus}>
        <p className={styles.empty}>{t('training.workout.noExercises')}</p>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {addExercise}
      </div>
    );
  }

  const index = exercises.indexOf(exercise);
  const name = exerciseDisplayName(exercise, locale);
  const entries = setEntries(exercise.sets);
  const isDone = (entry: SetEntry) => entry.set.completed || done.has(entry.set.id);
  const current =
    entries.find((entry) => entry.set.id === selection.setId) ??
    entries.find((entry) => !isDone(entry)) ??
    null;
  // The next open set anywhere – this exercise first, then the following ones.
  const ahead = nextPosition(exercises, index, done);
  const elsewhere = ahead?.exerciseId === exercise.id ? null : ahead;
  const exerciseName = (id: string) => {
    const target = exercises.find((e) => e.id === id);
    return target ? exerciseDisplayName(target, locale) : '';
  };

  function completed(setId: string) {
    const after = positionAfter(exercises, exercise?.id ?? '', setId, done);
    onSelect(
      after
        ? {
            exerciseId: after.exerciseId,
            setId: after.setId,
            completedId: setId,
            advanced: after.exerciseId !== exercise?.id,
          }
        : { exerciseId: exercise?.id ?? null, setId: null, completedId: setId, advanced: false },
    );
    setLocked(true);
    window.clearTimeout(lockTimer.current);
    lockTimer.current = window.setTimeout(() => {
      setLocked(false);
    }, COMPLETE_LOCK_MS);
  }

  async function addSet() {
    const id = await run((s, profileId) => s.workouts.addSet(profileId, exercise?.id ?? ''));
    if (id) select({ exerciseId: exercise?.id ?? null, setId: id });
  }

  return (
    <div className={styles.focus}>
      <article className={styles.exercise} aria-label={name}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.nav}
            aria-label={t('training.focus.previous')}
            disabled={index === 0}
            onClick={() => {
              select({ exerciseId: exercises[index - 1]?.id ?? null });
            }}
          >
            <Icon name="chevronLeft" size={22} />
          </button>
          <div className={styles.title}>
            <p className={styles.position}>
              {t('training.focus.position', { number: index + 1, count: exercises.length })}
            </p>
            <h2 className={styles.name}>{name}</h2>
          </div>
          <button
            type="button"
            className={styles.nav}
            aria-label={t('training.focus.next')}
            disabled={index === exercises.length - 1}
            onClick={() => {
              select({ exerciseId: exercises[index + 1]?.id ?? null });
            }}
          >
            <Icon name="chevronRight" size={22} />
          </button>
        </header>

        {selection.advanced ? (
          <p className={styles.advanced} role="status">
            <Icon name="arrowRight" size={16} />
            {t('training.focus.nextExercise', { name })}
          </p>
        ) : null}

        <ExerciseHints exercise={exercise} live onChange={(change) => void run(change)} />

        {entries.length > 0 ? (
          <ol className={styles.sets} aria-label={t('training.focus.setsLabel', { name })}>
            {entries.map((entry) => {
              const names = setNames(entry, t);
              const value = formatSetShort(entry.set, exercise.exerciseType, unit, locale);
              const finished = isDone(entry);
              const selected = entry.set.id === current?.set.id;
              return (
                <li key={entry.set.id}>
                  <button
                    type="button"
                    className={styles.set}
                    data-done={finished}
                    data-type={entry.kind}
                    aria-current={selected ? 'step' : undefined}
                    aria-label={t(finished ? 'training.focus.setDone' : 'training.focus.setOpen', {
                      label: names.label,
                      value,
                    })}
                    onClick={() => {
                      select({ exerciseId: exercise.id, setId: entry.set.id });
                    }}
                  >
                    <span className={styles.badge}>
                      {finished ? <Icon name="check" size={14} /> : null}
                      {names.badge}
                    </span>
                    <span className={styles.value}>{value}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : null}

        {current ? (
          <SetEditor
            key={`${exercise.exerciseId ?? ''}:${current.set.id}`}
            exercise={exercise}
            entry={current}
            names={setNames(current, t)}
            locked={locked}
            next={
              current.set.completed
                ? (nextPosition(exercises, index, new Set([...done, current.set.id])) ?? null)
                : null
            }
            onCompleted={completed}
            onReopened={() => {
              select({ exerciseId: exercise.id, setId: current.set.id });
            }}
            onGo={(position) => {
              select(position);
            }}
          />
        ) : (
          <div className={styles.done}>
            <p className={styles.doneTitle} role="status">
              <Icon name="check" size={20} />
              {ahead
                ? entries.length > 0
                  ? t('training.focus.exerciseDone')
                  : t('training.focus.noSets')
                : t('training.focus.allDone')}
            </p>
            {!ahead ? <p className={styles.hint}>{t('training.focus.allDoneHint')}</p> : null}
            {elsewhere ? (
              <Button
                fullWidth
                onClick={() => {
                  select(elsewhere);
                }}
              >
                {t('training.focus.continueWith', { name: exerciseName(elsewhere.exerciseId) })}
              </Button>
            ) : null}
            {!ahead ? (
              <Button
                fullWidth
                onClick={() => {
                  dismissKeyboard();
                  onFinish();
                }}
              >
                {t('training.focus.finishNow')}
              </Button>
            ) : null}
          </div>
        )}

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.action}
            aria-label={t('training.workout.addSetLabel')}
            onClick={() => void addSet()}
          >
            <Icon name="plus" size={18} />
            {t('training.workout.addSet')}
          </button>
          <button
            type="button"
            className={styles.action}
            onClick={() => {
              dismissKeyboard();
              setSheet('replace');
            }}
          >
            <Icon name="swap" size={16} />
            {t('training.workout.replaceExercise')}
          </button>
        </div>
      </article>

      {addExercise}

      {sheet === 'replace' ? (
        <ReplaceExercise
          exercise={exercise}
          live
          onChange={(change) => void run(change)}
          onClose={() => {
            setSheet(null);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * The set being entered: one −/+ stepper per value (time and distance are typed) and the one
 * primary action. A completed set can be corrected or reopened here; reopening never starts
 * the rest timer.
 */
function SetEditor({
  exercise,
  entry,
  names,
  locked,
  next,
  onCompleted,
  onReopened,
  onGo,
}: {
  exercise: WorkoutExerciseWithSets;
  entry: SetEntry;
  names: SetNames;
  locked: boolean;
  /** For a completed set: where "continue" leads. */
  next: FocusPosition | null;
  onCompleted: (setId: string) => void;
  onReopened: () => void;
  onGo: (position: FocusPosition) => void;
}) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const { fields, drafts, invalid, error, completed, saving, setDraft, save } = useSetDraft(
    entry.set,
    exercise.exerciseType,
  );

  return (
    <section className={styles.editor} aria-label={names.label} data-done={completed}>
      <div className={styles.editorHead}>
        <h3 className={styles.setLabel}>{names.label}</h3>
        {completed ? (
          <span className={styles.state}>
            <Icon name="check" size={16} />
            {t('training.focus.completed')}
          </span>
        ) : (
          <span className={styles.state} data-current="true">
            {t('training.focus.current')}
          </span>
        )}
      </div>
      <div className={styles.fields}>
        {fields.map((field) => {
          const header = t(headerKey(field, exercise.exerciseType));
          const stepField = isStepField(field) ? field : null;
          const step = stepField
            ? stepField === 'weightKg'
              ? `${formatDecimalInput(stepSize(stepField, unit), 2, locale)} ${unit}`
              : formatDecimalInput(stepSize(stepField, unit), 0, locale)
            : '';
          const stepTo = (direction: 1 | -1) =>
            stepField ? stepEntry(stepField, drafts[field], direction, unit, locale) : null;
          return (
            <Stepper
              key={field}
              caption={
                field === 'weightKg'
                  ? t('training.focus.loadCaption', { field: header, unit })
                  : header
              }
              label={`${names.label}: ${header}`}
              value={drafts[field]}
              integer={field === 'reps' || field === 'durationS'}
              invalid={invalid.includes(field)}
              onChange={(text) => {
                setDraft(field, text);
              }}
              onBlur={() => void save(completed)}
              {...(stepField
                ? {
                    onStep: (direction: 1 | -1) => {
                      const text = stepTo(direction);
                      if (text === null) return;
                      setDraft(field, text);
                      void save(completed, { ...drafts, [field]: text });
                    },
                    decreaseLabel: t('training.focus.decrease', { field: header, step }),
                    increaseLabel: t('training.focus.increase', { field: header, step }),
                    canDecrease: stepTo(-1) !== null,
                    canIncrease: stepTo(1) !== null,
                  }
                : {})}
            />
          );
        })}
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {completed ? (
        <div className={styles.completedActions}>
          <Button
            variant="secondary"
            onClick={() => {
              dismissKeyboard();
              void save(false).then((ok) => {
                if (ok) onReopened();
              });
            }}
          >
            {names.reopen}
          </Button>
          {next ? (
            <Button
              onClick={() => {
                onGo(next);
              }}
            >
              {t('training.focus.continue')}
            </Button>
          ) : null}
        </div>
      ) : (
        <Button
          className={styles.complete}
          fullWidth
          disabled={saving || locked}
          onClick={() => {
            dismissKeyboard();
            void save(true).then((ok) => {
              if (ok) onCompleted(entry.set.id);
            });
          }}
        >
          <Icon name="check" size={22} />
          {names.complete}
        </Button>
      )}
    </section>
  );
}
