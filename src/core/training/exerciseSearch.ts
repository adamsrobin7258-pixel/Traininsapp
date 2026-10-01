import {
  compareMatches,
  matchScore,
  searchKey,
  searchWords,
  type SearchKey,
} from '@/shared/lib/search';
import { exerciseDisplayName, type Equipment, type Exercise, type MuscleGroup } from './exercise';
import { exerciseAliases } from './exerciseCatalog';

/**
 * Muscle groups offered as filter. The stored data stays fine-grained (e.g. lats, quadriceps,
 * adductors); the filter combines them into groups people look for in the gym.
 */
export const MUSCLE_FILTERS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'legs',
  'glutes',
  'calves',
  'core',
  'forearms',
  'fullBody',
] as const;
export type MuscleFilter = (typeof MUSCLE_FILTERS)[number];

const FILTER_MUSCLES: Record<MuscleFilter, readonly MuscleGroup[]> = {
  chest: ['chest'],
  back: ['back', 'lats'],
  shoulders: ['shoulders'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  legs: ['quadriceps', 'hamstrings', 'adductors'],
  glutes: ['glutes'],
  calves: ['calves'],
  core: ['core'],
  forearms: ['forearms'],
  fullBody: ['fullBody'],
};

/** Filter groups an exercise belongs to, judged by its primary (main) muscles. */
export function muscleFiltersOf(exercise: Pick<Exercise, 'primaryMuscles'>): MuscleFilter[] {
  return MUSCLE_FILTERS.filter((filter) =>
    FILTER_MUSCLES[filter].some((muscle) => exercise.primaryMuscles.includes(muscle)),
  );
}

export interface ExerciseFilter {
  query?: string;
  muscle?: MuscleFilter | null;
  equipment?: Equipment | null;
}

/** Search keys of one exercise, prepared once per locale. */
export interface ExerciseSearchEntry {
  exercise: Exercise;
  name: string;
  /** Displayed name first, then the other language and the aliases. */
  keys: SearchKey[];
}

export function exerciseSearchIndex(
  exercises: readonly Exercise[],
  locale: string,
): ExerciseSearchEntry[] {
  return exercises.map((exercise) => {
    const name = exerciseDisplayName(exercise, locale);
    const other = locale === 'de' ? exercise.nameEn : exercise.nameDe;
    const names = [name, other, ...exerciseAliases(exercise.id)];
    // Same text twice (user exercises have one name) would only cost time.
    const keys = [...new Set(names)].map((text) => searchKey(text));
    return { exercise, name, keys };
  });
}

/**
 * A match on the other language or an alias ranks just after the same match on the displayed
 * name, but before weaker matches: "bankdrücken" (alias) lists the barbell bench press before
 * "Enges Bankdrücken".
 */
const FURTHER_NAME_PENALTY = 0.5;

function score(entry: ExerciseSearchEntry, words: readonly string[]): number | null {
  let best: number | null = null;
  entry.keys.forEach((key, index) => {
    const value = matchScore(key, words);
    if (value === null) return;
    const ranked = value + (index === 0 ? 0 : FURTHER_NAME_PENALTY);
    if (best === null || ranked < best) best = ranked;
  });
  return best;
}

/**
 * Searches and filters exercises. Case, accents, umlauts ("ue"), "ß", hyphens and partial
 * words are ignored, German and English names and aliases are searched. Each exercise appears
 * at most once. Without a query the result is sorted alphabetically.
 */
export function searchExercises(
  index: readonly ExerciseSearchEntry[],
  { query = '', muscle = null, equipment = null }: ExerciseFilter,
): Exercise[] {
  const words = searchWords(query);
  const matches: { exercise: Exercise; name: string; score: number }[] = [];
  for (const entry of index) {
    if (equipment && entry.exercise.equipment !== equipment) continue;
    if (muscle && !muscleFiltersOf(entry.exercise).includes(muscle)) continue;
    const value = words.length === 0 ? 0 : score(entry, words);
    if (value === null) continue;
    matches.push({ exercise: entry.exercise, name: entry.name, score: value });
  }
  if (words.length === 0) {
    return matches
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .map((match) => match.exercise);
  }
  return matches.sort(compareMatches).map((match) => match.exercise);
}
