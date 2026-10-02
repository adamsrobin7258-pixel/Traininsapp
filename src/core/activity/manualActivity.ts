import type { Intensity, VariantOption } from './catalog';

/** A sport or movement activity the user logged by hand. */
export interface ManualActivity {
  id: string;
  profileId: string;
  sportId: string;
  /** Local day of the activity, YYYY-MM-DD. */
  localDate: string;
  /** Optional start, ISO-8601 UTC. */
  startedAt: string | null;
  durationS: number;
  distanceM: number | null;
  intensity: Intensity | null;
  variant: VariantOption | null;
  /** Body weight used for the calculation (kg); `null` when none was known. */
  weightKg: number | null;
  met: number;
  metRef: string;
  metBasis: 'specific' | 'general';
  calcMethod: string;
  /** What Kalethra calculated; `null` without a body weight. */
  calculatedKcal: number | null;
  /** The value used everywhere (the user's own value when `kcalOverridden`). */
  kcal: number | null;
  kcalOverridden: boolean;
  createdAt: string;
  updatedAt: string;
}

/** What the form sends. Missing optional values are `null`, never 0. */
export interface ManualActivityInput {
  sportId: string;
  localDate: string;
  /** Local time "HH:MM" or `null`. */
  startTime: string | null;
  durationMin: number;
  distanceKm: number | null;
  intensity: Intensity | null;
  variant: VariantOption | null;
  /** The user's own kcal value; `null` uses the calculated value. */
  kcalOverride: number | null;
}

export const ACTIVITY_LIMITS = {
  durationMin: { min: 1, max: 1440 },
  distanceKm: { min: 0.01, max: 1000 },
  kcal: { min: 0, max: 10000 },
} as const;

export type ActivityErrorCode =
  | 'invalid-sport'
  | 'invalid-date'
  | 'future-date'
  | 'invalid-time'
  | 'invalid-duration'
  | 'invalid-distance'
  | 'invalid-kcal'
  | 'not-found';

export class ActivityError extends Error {
  constructor(readonly code: ActivityErrorCode) {
    super(`Activity operation rejected: ${code}`);
    this.name = 'ActivityError';
  }
}
