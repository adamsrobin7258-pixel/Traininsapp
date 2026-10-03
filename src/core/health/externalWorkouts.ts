/**
 * Activities imported from Health Connect. Pure TypeScript.
 *
 * They are kept strictly apart from Kalethra's own workouts: never part of a plan, never a
 * completed workout, never "next workout". Their active energy can optionally be added to the
 * day's calorie budget (see `countableActivityCalories`).
 */

import type { HealthPlatformId, HealthWorkout } from '@/core/platform/health';
import { toLocalDateKey } from '@/shared/lib/date';
import type { SyncWindow } from './importedHealth';

/** Broad families for icons and grouping; unknown types stay `other`. */
export type ActivityCategory =
  'strength' | 'endurance' | 'hybrid' | 'flexibility' | 'sport' | 'other';

const CATEGORY: Record<string, ActivityCategory> = {
  strengthTraining: 'strength',
  traditionalStrengthTraining: 'strength',
  functionalStrengthTraining: 'strength',
  weightlifting: 'strength',
  calisthenics: 'strength',
  coreTraining: 'strength',
  running: 'endurance',
  runningTreadmill: 'endurance',
  walking: 'endurance',
  hiking: 'endurance',
  cycling: 'endurance',
  bikingStationary: 'endurance',
  handCycling: 'endurance',
  swimming: 'endurance',
  swimmingPool: 'endurance',
  swimmingOpenWater: 'endurance',
  rowing: 'endurance',
  rowingMachine: 'endurance',
  elliptical: 'endurance',
  stairClimbing: 'endurance',
  stairClimbingMachine: 'endurance',
  stairs: 'endurance',
  crossCountrySkiing: 'endurance',
  snowshoeing: 'endurance',
  wheelchair: 'endurance',
  wheelchairRunPace: 'endurance',
  wheelchairWalkPace: 'endurance',
  paddling: 'endurance',
  paddleSports: 'endurance',
  jumpRope: 'endurance',
  skating: 'endurance',
  iceSkating: 'endurance',
  highIntensityIntervalTraining: 'hybrid',
  crossTraining: 'hybrid',
  mixedCardio: 'hybrid',
  bootCamp: 'hybrid',
  exerciseClass: 'hybrid',
  stepTraining: 'hybrid',
  burpee: 'hybrid',
  yoga: 'flexibility',
  pilates: 'flexibility',
  stretching: 'flexibility',
  flexibility: 'flexibility',
  taiChi: 'flexibility',
  barre: 'flexibility',
  mindAndBody: 'flexibility',
  cooldown: 'flexibility',
  preparationAndRecovery: 'flexibility',
  soccer: 'sport',
  basketball: 'sport',
  volleyball: 'sport',
  handball: 'sport',
  tennis: 'sport',
  tableTennis: 'sport',
  badminton: 'sport',
  squash: 'sport',
  padel: 'sport',
  pickleball: 'sport',
  golf: 'sport',
  boxing: 'sport',
  kickboxing: 'sport',
  martialArts: 'sport',
  climbing: 'sport',
  rockClimbing: 'sport',
  dance: 'sport',
  dancing: 'sport',
  skiing: 'sport',
  downhillSkiing: 'sport',
  snowboarding: 'sport',
  surfing: 'sport',
  hockey: 'sport',
  iceHockey: 'sport',
  rugby: 'sport',
  americanFootball: 'sport',
  baseball: 'sport',
  softball: 'sport',
  cricket: 'sport',
};

export function activityCategory(type: string): ActivityCategory {
  return CATEGORY[type] ?? 'other';
}

/** Activity types with their own translated name; all others are shown by their provider name. */
export const NAMED_ACTIVITY_TYPES = Object.keys(CATEGORY);

/**
 * Display fallback for a provider type without a translation: the provider's own name made
 * readable ("frisbeeDisc" → "Frisbee disc"), not guessed into another sport.
 */
export function readableActivityType(type: string): string {
  const words = type
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : type;
}

export interface ExternalWorkout {
  id: string;
  profileId: string;
  platform: HealthPlatformId;
  externalId: string;
  /** Provider type as reported. */
  activityType: string;
  category: ActivityCategory;
  startedAt: string;
  endedAt: string;
  /** Local day of the start, YYYY-MM-DD. */
  localDate: string;
  durationS: number;
  activeKcal: number | null;
  distanceM: number | null;
  steps: number | null;
  source: string | null;
}

/** An imported activity before it is stored. */
export type ExternalWorkoutDraft = Omit<ExternalWorkout, 'id' | 'profileId' | 'platform'>;

const MAX_DURATION_S = 24 * 60 * 60;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const LIMITS = { activeKcal: 10_000, distanceM: 1_000_000 } as const;

function instant(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A plausible optional number, or `null` (never an invented 0 for missing data). */
function optional(value: number | null, max: number, digits: number): number | null {
  if (value === null || !Number.isFinite(value) || value < 0 || value > max) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Sessions that can be stored: an ID, a start inside the sync window, an end after the start,
 * at most 24 hours, not in the future. Implausible energy or distance values are dropped (the
 * session is kept). Each record ID appears once.
 */
export function importableWorkouts(
  workouts: readonly HealthWorkout[],
  window: SyncWindow,
  now: Date,
): ExternalWorkoutDraft[] {
  const byId = new Map<string, ExternalWorkoutDraft>();
  for (const workout of workouts) {
    const start = instant(workout.start);
    const end = instant(workout.end);
    if (!workout.id || !start || !end) continue;
    const durationS = Math.round((end.getTime() - start.getTime()) / 1000);
    if (durationS <= 0 || durationS > MAX_DURATION_S) continue;
    if (end.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) continue;
    const localDate = toLocalDateKey(start);
    if (localDate < window.fromDate || localDate > window.toDate) continue;
    const type = workout.type.trim() || 'other';
    byId.set(workout.id, {
      externalId: workout.id,
      activityType: type,
      category: activityCategory(type),
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      localDate,
      durationS,
      activeKcal: optional(workout.activeKcal, LIMITS.activeKcal, 0),
      distanceM: optional(workout.distanceM, LIMITS.distanceM, 0),
      steps: null,
      source: workout.source?.trim() || null,
    });
  }
  return [...byId.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** A completed Kalethra workout as a time span. */
export interface OwnWorkoutSpan {
  startedAt: string;
  endedAt: string;
}

/** Share of the shorter session that two sessions overlap; at least this means "the same". */
export const SAME_SESSION_OVERLAP = 0.5;

/**
 * Whether an imported session is most likely the same session as a Kalethra workout – e.g. a
 * watch recording the gym session that was also logged in Kalethra. They count as the same
 * when they overlap for at least half of the shorter one.
 */
export function isSameSession(external: OwnWorkoutSpan, own: OwnWorkoutSpan): boolean {
  const a = [Date.parse(external.startedAt), Date.parse(external.endedAt)] as const;
  const b = [Date.parse(own.startedAt), Date.parse(own.endedAt)] as const;
  if (a.some(Number.isNaN) || b.some(Number.isNaN)) return false;
  const overlap = Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
  const shorter = Math.min(a[1] - a[0], b[1] - b[0]);
  return overlap > 0 && shorter > 0 && overlap / shorter >= SAME_SESSION_OVERLAP;
}

/**
 * Whether a session (imported, or manual with a start time) is one of the completed Kalethra
 * workouts – then it is Kalethra's own training and never counts again as an activity (calorie
 * budget, score minutes, progress).
 */
export function isKalethraWorkout(span: OwnWorkoutSpan, own: readonly OwnWorkoutSpan[]): boolean {
  return own.some((workout) => isSameSession(span, workout));
}

export interface ActivityCalories {
  /** Sum of active energy of the activities that may count (100 %, no adjustment). */
  kcal: number;
  /** Activities with active energy that count. */
  counted: number;
  /** Activities left out because they are the same session as a Kalethra workout. */
  excluded: number;
}

/**
 * Active energy of a day's imported activities, without any that duplicate a Kalethra workout
 * (those are Kalethra's own training – never counted twice). Activities without energy add 0.
 */
export function countableActivityCalories(
  activities: readonly Pick<ExternalWorkout, 'startedAt' | 'endedAt' | 'activeKcal'>[],
  own: readonly OwnWorkoutSpan[],
): ActivityCalories {
  let kcal = 0;
  let counted = 0;
  let excluded = 0;
  for (const activity of activities) {
    if (isKalethraWorkout(activity, own)) {
      excluded++;
      continue;
    }
    if (activity.activeKcal === null) continue;
    kcal += activity.activeKcal;
    counted++;
  }
  return { kcal: Math.round(kcal), counted, excluded };
}
