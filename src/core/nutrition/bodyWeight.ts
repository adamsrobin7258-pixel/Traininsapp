import type { PersonalData } from './calculation/calculate';
import type { TrainingSession } from './calculation/energy';
import type { WeightPoint } from './calculation/trend';

/**
 * Read access to body weight for nutrition calculations. Weight is owned by the health module
 * (`weight_entries`); this is only a view on it, wired in the app's composition root –
 * nutrition never stores weight itself.
 */
export interface BodyWeightSource {
  /** Latest weight in kg on or before a local day, `null` if none is known. */
  latestKgOnOrBefore(profileId: string, localDate: string): Promise<number | null>;
  /** Entries between two local days (inclusive), oldest first. */
  pointsBetween(profileId: string, fromDate: string, toDate: string): Promise<WeightPoint[]>;
  /** The latest entry on or before a day, `null` if none is known. */
  latestOnOrBefore(profileId: string, localDate: string): Promise<WeightPoint | null>;
}

/** Completed workouts from the training module (read only, nothing is entered twice). */
export interface TrainingActivitySource {
  sessionsBetween(profileId: string, fromDate: string, toDate: string): Promise<TrainingSession[]>;
}

/** Sex, birth date and height from the user profile. */
export interface PersonalDataSource {
  get(profileId: string): Promise<PersonalData>;
}

/**
 * Active calories of imported activities (Health Connect) on a local day, already without
 * sessions that duplicate a Kalethra workout. Display and the optional budget only – never
 * part of the stored goal or its calculation.
 */
export interface ActivityCaloriesSource {
  caloriesOn(
    profileId: string,
    localDate: string,
  ): Promise<{ kcal: number; counted: number; excluded: number }>;
  /** The same for every day of a range in one go, keyed by local day (days without: absent). */
  caloriesBetween?(
    profileId: string,
    fromLocalDate: string,
    toLocalDate: string,
  ): Promise<Map<string, { kcal: number; counted: number; excluded: number }>>;
}

/** Everything the nutrition calculation reads from other areas of the app. */
export interface NutritionSources {
  bodyWeight: BodyWeightSource;
  training: TrainingActivitySource;
  personal: PersonalDataSource;
  /** Optional: without it there is never an activity bonus. */
  activity?: ActivityCaloriesSource;
}
