import { sessionEnergyKcal } from '@/core/nutrition/calculation/energy';
import type { HealthExerciseType, HealthExportSession } from '@/core/platform/health';
import { getTrainingType } from '@/core/training/trainingTypes';

/**
 * Rules of the optional Health Connect export (pure, no I/O): which of Kalethra's own records
 * become which Health Connect exercise session, and which real values go with it as separate
 * records (active calories, distance). Only what Kalethra recorded itself is exported – never
 * imported activities – and only with a type that really fits: a Kalethra type without a
 * matching Health Connect type is not exported rather than turned into something else. A value
 * Kalethra does not have is never invented: no record instead of an estimate or a 0.
 */

/** Kalethra training types → Health Connect. Hyrox has no fitting type and stays local. */
export const WORKOUT_EXPORT_TYPES: Readonly<Record<string, HealthExerciseType>> = {
  strength: 'strengthTraining',
  hypertrophy: 'strengthTraining',
  powerlifting: 'strengthTraining',
  weightlifting: 'weightlifting',
  calisthenics: 'calisthenics',
  running: 'running',
  walking: 'walking',
  cycling: 'biking',
  mobility: 'stretching',
  stretching: 'stretching',
  other: 'otherWorkout',
};

/**
 * Sports of manual activities → Health Connect. Not exported, because Health Connect has no
 * matching type: swimming without pool/open water, water aerobics, padel, field hockey, Hyrox,
 * CrossFit, circuit training, jump rope, aerobics, tai chi, horse riding.
 */
export const ACTIVITY_EXPORT_TYPES: Readonly<Record<string, HealthExerciseType>> = {
  walk: 'walking',
  'brisk-walk': 'walking',
  'nordic-walking': 'walking',
  hike: 'hiking',
  'mountain-hike': 'hiking',
  jog: 'running',
  run: 'running',
  'fast-run': 'running',
  'trail-run': 'running',
  cycle: 'biking',
  'mountain-bike': 'biking',
  'indoor-cycling': 'bikingStationary',
  'rowing-boat': 'rowing',
  kayak: 'paddling',
  sup: 'paddling',
  surf: 'surfing',
  tennis: 'tennis',
  badminton: 'badminton',
  'table-tennis': 'tableTennis',
  squash: 'squash',
  soccer: 'soccer',
  basketball: 'basketball',
  volleyball: 'volleyball',
  'beach-volleyball': 'volleyball',
  handball: 'handball',
  'ice-hockey': 'iceHockey',
  hiit: 'highIntensityIntervalTraining',
  elliptical: 'elliptical',
  stairs: 'stairClimbing',
  'rowing-machine': 'rowingMachine',
  boxing: 'boxing',
  kickboxing: 'martialArts',
  'muay-thai': 'martialArts',
  judo: 'martialArts',
  'martial-arts': 'martialArts',
  ski: 'skiing',
  'cross-country-ski': 'skiing',
  snowboard: 'snowboarding',
  'ice-skate': 'iceSkating',
  'inline-skate': 'skating',
  snowshoe: 'snowshoeing',
  yoga: 'yoga',
  pilates: 'pilates',
  stretching: 'stretching',
  dance: 'dancing',
  climbing: 'rockClimbing',
  golf: 'golf',
};

export type ExportSourceKind = 'workout' | 'activity';

/** The Health Connect records one Kalethra record can become – each with its own client ID. */
export const EXPORT_RECORD_TYPES = ['session', 'calories', 'distance'] as const;
export type ExportRecordType = (typeof EXPORT_RECORD_TYPES)[number];
/** The records that belong to a session: an amount over its time span. */
export type ExportAmountType = Exclude<ExportRecordType, 'session'>;
export const EXPORT_AMOUNT_TYPES: readonly ExportAmountType[] = ['calories', 'distance'];

/** Upper bounds of an exported amount – the same as Kalethra's own input limits. */
export const EXPORT_LIMITS: Readonly<Record<ExportAmountType, number>> = {
  calories: 10_000,
  distance: 1_000_000,
};

/** Why a record is never written. */
export type ExportSkipReason = 'unsupported-type' | 'no-start-time' | 'invalid';

/** What the export needs of a completed Kalethra workout. */
export interface ExportableWorkout {
  id: string;
  trainingType: string;
  status: 'active' | 'completed';
  startedAt: string;
  endedAt: string | null;
  /** Seconds of training (set when finished) – the basis of the calorie value. */
  durationS: number | null;
  /** Local day of the start: the body weight of that day is used. */
  localDate: string;
  updatedAt: string;
}

/** What the export needs of a manual activity. */
export interface ExportableActivity {
  id: string;
  sportId: string;
  /** Optional when logging – without it there is no session to write. */
  startedAt: string | null;
  durationS: number;
  /** Active kcal shown in Kalethra (calculated or the user's own value); `null` without. */
  kcal: number | null;
  /** Logged distance in metres; `null` where the sport has none. */
  distanceM: number | null;
  updatedAt: string;
}

/**
 * The stable ID of a Kalethra record in Health Connect, per record type. Never changes for a
 * record. The session keeps the ID of the first export version ("kalethra:workout:<id>", no
 * suffix) so sessions already written are updated, never duplicated; the amounts get a suffix
 * ("kalethra:activity:<id>:calories", "…:distance").
 */
export function clientRecordId(
  kind: ExportSourceKind,
  id: string,
  type: ExportRecordType = 'session',
): string {
  return type === 'session' ? `kalethra:${kind}:${id}` : `kalethra:${kind}:${id}:${type}`;
}

/** A positive, finite amount within the limit – anything else is no value (never 0). */
export function validAmount(type: ExportAmountType, value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= EXPORT_LIMITS[type]
    ? value
    : null;
}

/**
 * Active kcal of a Kalethra workout: the formula Kalethra already uses for training energy
 * (`sessionEnergyKcal`: (MET of the training category − 1) × kg × hours, at most 3 h), with the
 * body weight of the workout's day, rounded to whole kcal. Net of resting energy – the same
 * meaning as Health Connect's active calories. `null` without a weight or a duration.
 */
export function workoutActiveKcal(
  workout: Pick<ExportableWorkout, 'trainingType' | 'durationS'>,
  weightKg: number | null,
): number | null {
  if (weightKg === null || !Number.isFinite(weightKg) || weightKg <= 0) return null;
  if (workout.durationS === null || !Number.isFinite(workout.durationS)) return null;
  const kcal = sessionEnergyKcal(
    {
      durationMinutes: workout.durationS / 60,
      category: getTrainingType(workout.trainingType).category,
    },
    weightKg,
  );
  return validAmount('calories', Math.round(kcal));
}

/** The record's version: its last change in Kalethra (epoch ms). */
export function recordVersion(updatedAt: string): number {
  const ms = Date.parse(updatedAt);
  return Number.isFinite(ms) ? ms : 0;
}

type Built = { session: HealthExportSession } | { skip: ExportSkipReason };

function session(
  kind: ExportSourceKind,
  id: string,
  exerciseType: HealthExerciseType,
  start: string,
  endMs: number,
  updatedAt: string,
): Built {
  const startMs = Date.parse(start);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { skip: 'invalid' };
  }
  return {
    session: {
      clientRecordId: clientRecordId(kind, id),
      clientRecordVersion: recordVersion(updatedAt),
      exerciseType,
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
    },
  };
}

/** The session of a completed workout: its type and its real start and end – nothing else. */
export function workoutSession(workout: ExportableWorkout): Built {
  if (workout.status !== 'completed' || !workout.endedAt) return { skip: 'invalid' };
  const type = WORKOUT_EXPORT_TYPES[workout.trainingType];
  if (!type) return { skip: 'unsupported-type' };
  return session(
    'workout',
    workout.id,
    type,
    workout.startedAt,
    Date.parse(workout.endedAt),
    workout.updatedAt,
  );
}

/**
 * The session of a manual activity: start and duration as logged. Without a start time there
 * is no session – a time is never invented.
 */
export function activitySession(activity: ExportableActivity): Built {
  const type = ACTIVITY_EXPORT_TYPES[activity.sportId];
  if (!type) return { skip: 'unsupported-type' };
  if (!activity.startedAt) return { skip: 'no-start-time' };
  return session(
    'activity',
    activity.id,
    type,
    activity.startedAt,
    Date.parse(activity.startedAt) + activity.durationS * 1000,
    activity.updatedAt,
  );
}

/** What one Kalethra record becomes: its session and – only with a real value – its amounts. */
export type ExportPlan =
  | { skip: ExportSkipReason }
  | {
      session: HealthExportSession;
      amounts: Readonly<Record<ExportAmountType, number | null>>;
    };

/**
 * A completed workout: its session plus active calories (with a known body weight). Kalethra
 * has no distance per workout – distances of single sets (intervals, carries) are not a
 * session distance and stay local.
 */
export function workoutExport(workout: ExportableWorkout, weightKg: number | null): ExportPlan {
  const built = workoutSession(workout);
  if ('skip' in built) return built;
  return {
    session: built.session,
    amounts: { calories: workoutActiveKcal(workout, weightKg), distance: null },
  };
}

/** A manual activity: its session plus the kcal and the distance it shows, where present. */
export function activityExport(activity: ExportableActivity): ExportPlan {
  const built = activitySession(activity);
  if ('skip' in built) return built;
  return {
    session: built.session,
    amounts: {
      calories: validAmount('calories', activity.kcal),
      distance: validAmount('distance', activity.distanceM),
    },
  };
}
