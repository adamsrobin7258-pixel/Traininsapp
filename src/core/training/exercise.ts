/**
 * Exercise domain. System exercises come from the bundled catalog (translated names);
 * user exercises carry the name the user typed and are never translated.
 */

/** Which set fields an exercise records. Drives validation and the set input UI. */
export const EXERCISE_TYPES = [
  /** External load × repetitions (bench press). */
  'weighted',
  /** Repetitions, optional added load (pull-up, dip). */
  'bodyweight',
  /** Duration only (plank, stretch). */
  'timed',
  /** Distance, optional duration (sled push, farmer's carry, row erg). */
  'distance',
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'lats',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'glutes',
  'quadriceps',
  'hamstrings',
  'calves',
  'fullBody',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'machine',
  'cable',
  'bodyweight',
  'band',
  'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const MOVEMENT_PATTERNS = [
  'horizontalPush',
  'verticalPush',
  'horizontalPull',
  'verticalPull',
  'squat',
  'hinge',
  'lunge',
  'carry',
  'core',
  'isolation',
  'other',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export type ExerciseSource = 'system' | 'user';

export interface Exercise {
  id: string;
  source: ExerciseSource;
  /** Owner of a user exercise; `null` for system exercises. */
  profileId: string | null;
  /** System: translated names. User: both equal the typed name. */
  nameDe: string;
  nameEn: string;
  exerciseType: ExerciseType;
  equipment: Equipment;
  movementPattern: MovementPattern;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  instructionsDe: string | null;
  instructionsEn: string | null;
  active: boolean;
}

export const EXERCISE_NAME_MAX_LENGTH = 60;

/** Name shown to the user: translated for system exercises, as typed for user exercises. */
export function exerciseDisplayName(
  exercise: Pick<Exercise, 'nameDe' | 'nameEn'>,
  locale: string,
): string {
  return locale === 'de' ? exercise.nameDe : exercise.nameEn;
}

export type ExerciseNameError = 'empty' | 'tooLong';

export function normalizeExerciseName(
  input: string,
): { ok: true; name: string } | { ok: false; error: ExerciseNameError } {
  const name = input.replace(/\s+/g, ' ').trim();
  if (name === '') return { ok: false, error: 'empty' };
  if (Array.from(name).length > EXERCISE_NAME_MAX_LENGTH) return { ok: false, error: 'tooLong' };
  return { ok: true, name };
}

/** Case- and accent-insensitive search in both languages. */
export function matchesExerciseSearch(exercise: Exercise, query: string): boolean {
  const normalize = (text: string) =>
    text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const needle = normalize(query.trim());
  if (needle === '') return true;
  return [exercise.nameDe, exercise.nameEn].some((name) => normalize(name).includes(needle));
}

export function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}
