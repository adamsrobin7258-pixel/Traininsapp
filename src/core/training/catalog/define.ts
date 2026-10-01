import type { Equipment, ExerciseType, MovementPattern, MuscleGroup } from '../exercise';

/**
 * One bundled system exercise. IDs are permanent: never rename or reuse one, because plans and
 * workouts reference them. Names, descriptions and aliases may be improved in later versions.
 */
export interface CatalogExercise {
  id: `sys.${string}`;
  nameDe: string;
  nameEn: string;
  exerciseType: ExerciseType;
  equipment: Equipment;
  movementPattern: MovementPattern;
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  /** Short, factual execution notes (1–2 sentences) – no promises about results. */
  descriptionDe: string;
  descriptionEn: string;
  /** Further search terms (abbreviations, other common names); never separate exercises. */
  aliases: string[];
}

type Input = Omit<CatalogExercise, 'exerciseType' | 'secondary' | 'aliases'> &
  Partial<Pick<CatalogExercise, 'exerciseType' | 'secondary' | 'aliases'>>;

/** Defaults: weighted (load × reps), no secondary muscles, no aliases. */
export function ex(input: Input): CatalogExercise {
  return { exerciseType: 'weighted', secondary: [], aliases: [], ...input };
}
