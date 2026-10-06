/**
 * Which muscle groups a figure highlights – derived only from the exercise data
 * (`primaryMuscles` / `secondaryMuscles` of the catalog), never from a second muscle list.
 * Pure. Used by the exercise details and the workout summary; it is a picture, no score.
 */
import { MUSCLE_GROUPS, type Exercise, type MovementPattern, type MuscleGroup } from './exercise';

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

/**
 * Movement types of the figure – one shared body, one animation clip per movement type, never
 * one model per exercise. `rest` is the standing pose (e.g. the workout summary).
 */
export const FIGURE_MOVEMENTS = [
  'rest',
  'horizontalPush',
  'verticalPush',
  'horizontalPull',
  'verticalPull',
  'squat',
  'hinge',
  'lunge',
  'curl',
  'extension',
  'raise',
  'carry',
  'core',
] as const;
export type FigureMovement = (typeof FIGURE_MOVEMENTS)[number];

/**
 * The library's movement pattern decides the movement type; only "isolation" and "other" need
 * the exercise to say which one (curl, extension, raise …).
 */
const PATTERN_MOVEMENT: Record<MovementPattern, FigureMovement | null> = {
  horizontalPush: 'horizontalPush',
  verticalPush: 'verticalPush',
  horizontalPull: 'horizontalPull',
  verticalPull: 'verticalPull',
  squat: 'squat',
  hinge: 'hinge',
  lunge: 'lunge',
  carry: 'carry',
  core: 'core',
  isolation: null,
  other: null,
};

export function movementForPattern(pattern: MovementPattern): FigureMovement | null {
  return PATTERN_MOVEMENT[pattern];
}

/**
 * Which exercises show the figure, and how. Muscles are never stored here – they come from the
 * exercise. `movement` is only given where the pattern does not decide it; `variant` names the
 * equipment set-up of the clip (clip "horizontalPush_bench"), so one movement type can have a
 * bench and a floor version without a model per exercise.
 */
interface VisualEntry {
  side: 'front' | 'back';
  variant?: string;
  movement?: FigureMovement;
}

export const EXERCISE_VISUALS: Readonly<Record<string, VisualEntry>> = {
  'sys.bench-press': { side: 'front', variant: 'bench' },
  'sys.lat-pulldown': { side: 'back', variant: 'cable' },
};

/** How an exercise is shown in 3D: movement type, the clip to play and the side seen first. */
export interface ExerciseVisual {
  movement: FigureMovement;
  /** Animation clip: "<movement>" or "<movement>_<variant>". */
  clip: string;
  side: 'front' | 'back';
}

/** Exercise → movement type → clip; `null` when the exercise has no 3D visual (yet). */
export function exerciseVisual(
  exercise: Pick<Exercise, 'id' | 'movementPattern'>,
): ExerciseVisual | null {
  const entry = EXERCISE_VISUALS[exercise.id];
  if (!entry) return null;
  const movement = entry.movement ?? movementForPattern(exercise.movementPattern);
  if (!movement) return null;
  return {
    movement,
    clip: entry.variant ? `${movement}_${entry.variant}` : movement,
    side: entry.side,
  };
}

/** The standing pose for a picture of several exercises (workout summary). */
export const REST_VISUAL: ExerciseVisual = { movement: 'rest', clip: 'rest', side: 'front' };

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
