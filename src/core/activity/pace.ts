/**
 * Pace (minutes per kilometre) derived from distance and duration – never stored. Pure.
 *
 * Only for activities on foot, where pace is the usual measure of speed: the sport categories
 * `walking` and `running`, and the Health Connect types those sports map to. Cycling,
 * swimming, rowing, team or strength sports get no pace. See docs/ACTIVITIES.md.
 */

import { SPORTS, sportById, type SportCategory } from './catalog';

/** Manual sports with a pace: walking, hiking and running sports. */
export const PACE_CATEGORIES: readonly SportCategory[] = ['walking', 'running'];

/** Health Connect types with a pace: exactly those of the manual sports with a pace. */
export const PACE_HEALTH_CONNECT_TYPES: ReadonlySet<string> = new Set(
  SPORTS.filter((sport) => PACE_CATEGORIES.includes(sport.category)).flatMap(
    (sport) => sport.healthConnectTypes,
  ),
);

/**
 * A pace is only shown when it is plausible: at least 100 m, and between 2 and 60 min/km
 * (30 down to 1 km/h). Anything else is a recording or input error, not a pace worth showing.
 */
export const PACE_LIMITS = {
  minDistanceM: 100,
  minSecondsPerKm: 2 * 60,
  maxSecondsPerKm: 60 * 60,
} as const;

/** Seconds per kilometre, rounded to whole seconds; `null` when no plausible pace exists. */
export function paceSecondsPerKm(
  distanceM: number | null,
  durationS: number | null,
): number | null {
  if (distanceM === null || durationS === null) return null;
  if (!Number.isFinite(distanceM) || !Number.isFinite(durationS)) return null;
  if (distanceM < PACE_LIMITS.minDistanceM || durationS <= 0) return null;
  const pace = Math.round(durationS / (distanceM / 1000));
  return pace >= PACE_LIMITS.minSecondsPerKm && pace <= PACE_LIMITS.maxSecondsPerKm ? pace : null;
}

/** Pace of a manual activity – only for sports on foot. */
export function sportPace(
  sportId: string,
  distanceM: number | null,
  durationS: number | null,
): number | null {
  const sport = sportById(sportId);
  if (!sport || !PACE_CATEGORIES.includes(sport.category)) return null;
  return paceSecondsPerKm(distanceM, durationS);
}

/** Pace of an imported Health Connect activity – only for types on foot. */
export function importedPace(
  activityType: string,
  distanceM: number | null,
  durationS: number | null,
): number | null {
  if (!PACE_HEALTH_CONNECT_TYPES.has(activityType)) return null;
  return paceSecondsPerKm(distanceM, durationS);
}
