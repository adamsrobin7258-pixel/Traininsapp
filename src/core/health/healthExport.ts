import type { HealthExerciseType, HealthExportSession } from '@/core/platform/health';

/**
 * Rules of the optional Health Connect export (pure, no I/O): which of Kalethra's own records
 * become which Health Connect exercise session. Only what Kalethra recorded itself is exported –
 * never imported activities – and only with a type that really fits: a Kalethra type without a
 * matching Health Connect type is not exported rather than turned into something else.
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

/** Why a record is never written. */
export type ExportSkipReason = 'unsupported-type' | 'no-start-time' | 'invalid';

/** What the export needs of a completed Kalethra workout. */
export interface ExportableWorkout {
  id: string;
  trainingType: string;
  status: 'active' | 'completed';
  startedAt: string;
  endedAt: string | null;
  updatedAt: string;
}

/** What the export needs of a manual activity. */
export interface ExportableActivity {
  id: string;
  sportId: string;
  /** Optional when logging – without it there is no session to write. */
  startedAt: string | null;
  durationS: number;
  updatedAt: string;
}

/** The stable ID of a Kalethra record in Health Connect. Never changes for a record. */
export function clientRecordId(kind: ExportSourceKind, id: string): string {
  return `kalethra:${kind}:${id}`;
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
