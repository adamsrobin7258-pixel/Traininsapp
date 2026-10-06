/**
 * Which muscle groups a figure highlights – derived only from the exercise data
 * (`primaryMuscles` / `secondaryMuscles` of the catalog), never from a second muscle list.
 * Pure. Used by the exercise details and the workout summary; it is a picture, no score.
 */
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from './exercise';

/** The groups a figure can show; "fullBody" is no region of its own but stands for all. */
export type FigureMuscle = Exclude<MuscleGroup, 'fullBody'>;
export const FIGURE_MUSCLES: readonly FigureMuscle[] = MUSCLE_GROUPS.filter(
  (group): group is FigureMuscle => group !== 'fullBody',
);

export type MuscleLevel = 'primary' | 'secondary';
/** Highlighted groups; a group that is missing stays neutral. */
export type MuscleHighlight = Partial<Record<FigureMuscle, MuscleLevel>>;

type MuscleSource = Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles'>;

const expand = (groups: readonly MuscleGroup[]): FigureMuscle[] =>
  groups.includes('fullBody')
    ? [...FIGURE_MUSCLES]
    : groups.filter((group): group is FigureMuscle => group !== 'fullBody');

/** One exercise: primary groups stronger, secondary weaker; a group listed in both is primary. */
export function muscleHighlight(exercise: MuscleSource): MuscleHighlight {
  return aggregateMuscleHighlight([exercise]);
}

/**
 * Several exercises (e.g. all exercises done in a workout): a group is primary when it is
 * primary in at least one exercise, otherwise secondary when it is secondary in one. A simple,
 * traceable union – no weighting by sets or load.
 */
export function aggregateMuscleHighlight(exercises: readonly MuscleSource[]): MuscleHighlight {
  const result: MuscleHighlight = {};
  for (const exercise of exercises) {
    for (const group of expand(exercise.secondaryMuscles)) result[group] ??= 'secondary';
  }
  for (const exercise of exercises) {
    for (const group of expand(exercise.primaryMuscles)) result[group] = 'primary';
  }
  return result;
}

/** Groups of a highlight per level, in the catalog's order (for labels and tests). */
export function highlightGroups(highlight: MuscleHighlight): Record<MuscleLevel, FigureMuscle[]> {
  return {
    primary: FIGURE_MUSCLES.filter((group) => highlight[group] === 'primary'),
    secondary: FIGURE_MUSCLES.filter((group) => highlight[group] === 'secondary'),
  };
}

/** The movement a figure can play. One shared figure, one motion per exercise. */
export const FIGURE_MOTIONS = ['benchPress', 'latPulldown'] as const;
export type FigureMotion = (typeof FIGURE_MOTIONS)[number];

/** How an exercise is shown in 3D: its motion and the side that shows its main muscles. */
export interface ExerciseVisual {
  motion: FigureMotion;
  side: 'front' | 'back';
}

/**
 * Exercise ID → 3D visual. The IDs are the permanent catalog IDs; muscles are not stored here
 * (they come from the exercise). Prototype: two exercises; every other exercise has no visual
 * and its details stay as they are.
 */
export const EXERCISE_VISUALS: Readonly<Record<string, ExerciseVisual>> = {
  'sys.bench-press': { motion: 'benchPress', side: 'front' },
  'sys.lat-pulldown': { motion: 'latPulldown', side: 'back' },
};

export function exerciseVisual(exerciseId: string | null): ExerciseVisual | null {
  return exerciseId !== null ? (EXERCISE_VISUALS[exerciseId] ?? null) : null;
}

/**
 * The exercises of a workout that were actually done – at least one completed set – resolved to
 * their catalog data. Exercises that no longer exist (`exerciseId` null or unknown) are left out.
 */
export function doneExercises<T extends MuscleSource>(
  workout: {
    exercises: readonly { exerciseId: string | null; sets: readonly { completed: boolean }[] }[];
  },
  exerciseById: (id: string) => T | undefined,
): T[] {
  return workout.exercises.flatMap((entry) => {
    if (entry.exerciseId === null || !entry.sets.some((set) => set.completed)) return [];
    const exercise = exerciseById(entry.exerciseId);
    return exercise ? [exercise] : [];
  });
}
