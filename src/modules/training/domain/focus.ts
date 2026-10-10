import { groupSets, type WorkoutExerciseWithSets, type WorkoutSet } from '@/core/training';

/**
 * Where the focus view of a workout in progress stands: which exercise, and which of its sets
 * is entered next. Pure – derived from the stored workout every time, nothing is kept.
 *
 * The order is the one of `groupSets` (and of the full list): warm-ups, then each working set
 * followed by its drops; exercises in workout order.
 */

export type SetKind = 'warmup' | 'working' | 'drop';

export interface SetEntry {
  set: WorkoutSet;
  kind: SetKind;
  /** Warm-ups count on their own (A1, A2), working sets 1, 2, …; a drop names its set. */
  number: number;
  /** For drops: 1, 2, … within the chain of its working set. */
  drop: number;
}

/** The sets of one exercise in training order, with their numbering. */
export function setEntries(sets: readonly WorkoutSet[]): SetEntry[] {
  const { warmups, working } = groupSets(sets);
  return [
    ...warmups.map((set, i) => ({ set, kind: 'warmup' as const, number: i + 1, drop: 0 })),
    ...working.flatMap((group, i) => [
      { set: group.set, kind: 'working' as const, number: i + 1, drop: 0 },
      ...group.drops.map((set, d) => ({ set, kind: 'drop' as const, number: i + 1, drop: d + 1 })),
    ]),
  ];
}

/**
 * The first set of the exercise that is not completed, in training order; `null` when every
 * set is completed or there is none. `done` lists sets to treat as completed (a set that was
 * just completed while the reloaded workout has not arrived yet).
 */
export function nextOpenSet(
  exercise: WorkoutExerciseWithSets,
  done: ReadonlySet<string> = new Set(),
): WorkoutSet | null {
  return (
    setEntries(exercise.sets).find(({ set }) => !set.completed && !done.has(set.id))?.set ?? null
  );
}

export interface FocusPosition {
  exerciseId: string;
  setId: string;
}

/**
 * The next open set of the workout, searching from the exercise at `fromIndex` to the end and
 * then from the start; `null` when nothing is open any more.
 */
export function nextPosition(
  exercises: readonly WorkoutExerciseWithSets[],
  fromIndex = 0,
  done: ReadonlySet<string> = new Set(),
): FocusPosition | null {
  const count = exercises.length;
  for (let step = 0; step < count; step += 1) {
    const exercise = exercises[(Math.max(0, fromIndex) + step) % count];
    if (!exercise) continue;
    const set = nextOpenSet(exercise, done);
    if (set) return { exerciseId: exercise.id, setId: set.id };
  }
  return null;
}

/**
 * Where to go after `completedSetId` of `exerciseId` was completed: the next open set of the
 * same exercise after it (then an earlier one that was skipped), else the next exercise with an
 * open set (later ones first, then earlier ones), else `null` – everything is done. `done` as
 * for `nextOpenSet`.
 */
export function positionAfter(
  exercises: readonly WorkoutExerciseWithSets[],
  exerciseId: string,
  completedSetId: string,
  done: ReadonlySet<string> = new Set(),
): FocusPosition | null {
  const finished = new Set([...done, completedSetId]);
  const index = exercises.findIndex((exercise) => exercise.id === exerciseId);
  const exercise = exercises[index];
  if (exercise) {
    const entries = setEntries(exercise.sets);
    const from = entries.findIndex((entry) => entry.set.id === completedSetId);
    const open = (entry: SetEntry) => !entry.set.completed && !finished.has(entry.set.id);
    const later = entries.slice(from + 1).find(open) ?? entries.find(open);
    if (later) return { exerciseId: exercise.id, setId: later.set.id };
  }
  return nextPosition(exercises, index === -1 ? 0 : index + 1, finished);
}

/**
 * What the focus view shows. Empty fields mean "where the workout stands": the first exercise
 * with an open set and its next open set. A choice of the user (another exercise or set) stays
 * until the next one – reloads never move it.
 */
export interface FocusSelection {
  exerciseId: string | null;
  setId: string | null;
  /** The set just completed; counted as completed until the reloaded workout shows it. */
  completedId: string | null;
  /** The focus moved on to another exercise by itself – it is announced. */
  advanced: boolean;
}

export const AUTO_FOCUS: FocusSelection = {
  exerciseId: null,
  setId: null,
  completedId: null,
  advanced: false,
};
