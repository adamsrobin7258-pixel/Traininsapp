import { registerPlugin } from '@capacitor/core';
import { getPlatform } from '../platform';
import type { HealthAvailability } from './types';

/**
 * Platform boundary for *writing* Kalethra's own exercise sessions to the device's health store
 * (Android Health Connect; Settings → App → Health Connect). Separate from `HealthPlatform`,
 * which only reads: a later Apple Health export or a richer import can each grow on its own.
 *
 *   core/health/healthExportService  →  HealthExportPlatform (this file)  →  native plugin
 *                                                                            (android/app:
 *                                                                            HealthExportPlugin.kt)
 *
 * Written are the type and times of a session and – where Kalethra has a real value – the active
 * calories and the distance of the same time span. Never a title, notes, sets or a route.
 */

/**
 * Health Connect exercise types Kalethra writes. The native plugin maps exactly these names to
 * `ExerciseSessionRecord.EXERCISE_TYPE_*` and refuses any other.
 */
export const HEALTH_EXERCISE_TYPES = [
  'strengthTraining',
  'weightlifting',
  'calisthenics',
  'running',
  'walking',
  'hiking',
  'biking',
  'bikingStationary',
  'stretching',
  'yoga',
  'pilates',
  'highIntensityIntervalTraining',
  'rowing',
  'rowingMachine',
  'paddling',
  'surfing',
  'tennis',
  'badminton',
  'tableTennis',
  'squash',
  'soccer',
  'basketball',
  'volleyball',
  'handball',
  'iceHockey',
  'elliptical',
  'stairClimbing',
  'boxing',
  'martialArts',
  'skiing',
  'snowboarding',
  'iceSkating',
  'skating',
  'snowshoeing',
  'dancing',
  'rockClimbing',
  'golf',
  'otherWorkout',
] as const;
export type HealthExerciseType = (typeof HEALTH_EXERCISE_TYPES)[number];

/** One session to write. Times as ISO-8601 UTC; `end` after `start`. */
export interface HealthExportSession {
  /**
   * Stable ID of Kalethra's record ("kalethra:workout:<id>"). The health store treats a second
   * write with the same ID as an update – the write is idempotent.
   */
  clientRecordId: string;
  /** Last change in Kalethra (epoch ms): a newer version replaces the stored one. */
  clientRecordVersion: number;
  exerciseType: HealthExerciseType;
  start: string;
  end: string;
}

/** One amount over the time span of a session: active calories or a distance. */
interface HealthExportAmount {
  /** Stable ID per Kalethra record and data type ("kalethra:activity:<id>:calories"). */
  clientRecordId: string;
  clientRecordVersion: number;
  start: string;
  end: string;
}

/** Active energy (without resting energy) in kilocalories. */
export interface HealthExportCalories extends HealthExportAmount {
  kcal: number;
}

/** A distance really logged in Kalethra, in metres. */
export interface HealthExportDistance extends HealthExportAmount {
  meters: number;
}

/** The record types Kalethra may write – one write permission each. */
export const HEALTH_WRITE_TYPES = ['exercise', 'activeCalories', 'distance'] as const;
export type HealthWriteType = (typeof HEALTH_WRITE_TYPES)[number];
/** Which write permissions Health Connect granted right now. */
export type HealthWriteAccess = Readonly<Record<HealthWriteType, boolean>>;
export const NO_WRITE_ACCESS: HealthWriteAccess = {
  exercise: false,
  activeCalories: false,
  distance: false,
};

export type HealthExportErrorCode =
  /** The health store is not available (anymore). */
  | 'unavailable'
  /** The write permission is missing or was revoked. */
  | 'permission'
  /** The record was refused as invalid – retrying the same record cannot help. */
  | 'invalid'
  /** Any other failure; a later attempt may succeed. */
  | 'failed';

export class HealthExportError extends Error {
  constructor(readonly code: HealthExportErrorCode) {
    super(`Health export failed: ${code}`);
    this.name = 'HealthExportError';
  }
}

export interface HealthExportPlatform {
  availability(): Promise<HealthAvailability>;
  /** Which record types Kalethra may write, without asking. */
  checkWriteAccess(): Promise<HealthWriteAccess>;
  /**
   * Shows the platform's permission dialog for the write permissions not granted yet; the
   * result is checked again.
   */
  requestWriteAccess(): Promise<HealthWriteAccess>;
  /** Writes (inserts or updates) one session; throws `HealthExportError`. */
  writeExerciseSession(session: HealthExportSession): Promise<void>;
  /** Writes (inserts or updates) the active calories of a session; throws `HealthExportError`. */
  writeActiveCalories(record: HealthExportCalories): Promise<void>;
  /** Writes (inserts or updates) the distance of a session; throws `HealthExportError`. */
  writeDistance(record: HealthExportDistance): Promise<void>;
  /**
   * Deletes one of Kalethra's own amount records by its client record ID (a value that was
   * removed in Kalethra). Never touches records of other apps; a missing record is no error.
   */
  deleteAmount(type: 'activeCalories' | 'distance', clientRecordId: string): Promise<void>;
}

interface NativeExportPlugin {
  availability(): Promise<{ status: 'available' | 'needsInstall' | 'unsupported' }>;
  checkWriteAccess(): Promise<Partial<Record<HealthWriteType, boolean>>>;
  requestWriteAccess(): Promise<Partial<Record<HealthWriteType, boolean>>>;
  writeExerciseSession(session: HealthExportSession): Promise<{ written: boolean }>;
  writeActiveCalories(record: HealthExportCalories): Promise<{ written: boolean }>;
  writeDistance(record: HealthExportDistance): Promise<{ written: boolean }>;
  deleteAmount(options: {
    type: 'activeCalories' | 'distance';
    clientRecordId: string;
  }): Promise<{ deleted: boolean }>;
}

const CODES: readonly HealthExportErrorCode[] = ['unavailable', 'permission', 'invalid', 'failed'];

function toExportError(error: unknown): HealthExportError {
  if (error instanceof HealthExportError) return error;
  const code = (error as { code?: unknown } | null)?.code;
  return new HealthExportError(CODES.find((known) => known === code) ?? 'failed');
}

/** Only an explicit `true` counts as granted. */
function toWriteAccess(raw: Partial<Record<HealthWriteType, boolean>>): HealthWriteAccess {
  return {
    exercise: raw.exercise === true,
    activeCalories: raw.activeCalories === true,
    distance: raw.distance === true,
  };
}

async function settle(work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch (error) {
    throw toExportError(error);
  }
}

function createAndroidExportPlatform(): HealthExportPlatform {
  const plugin = registerPlugin<NativeExportPlugin>('KalethraHealthExport');
  return {
    async availability() {
      try {
        const { status } = await plugin.availability();
        if (status === 'available') return { kind: 'available', platform: 'healthConnect' };
        return status === 'needsInstall' ? { kind: 'needsInstall' } : { kind: 'unsupported' };
      } catch {
        return { kind: 'unsupported' };
      }
    },
    async checkWriteAccess() {
      try {
        return toWriteAccess(await plugin.checkWriteAccess());
      } catch {
        return NO_WRITE_ACCESS;
      }
    },
    async requestWriteAccess() {
      try {
        return toWriteAccess(await plugin.requestWriteAccess());
      } catch {
        return NO_WRITE_ACCESS;
      }
    },
    writeExerciseSession: (session) => settle(() => plugin.writeExerciseSession(session)),
    writeActiveCalories: (record) => settle(() => plugin.writeActiveCalories(record)),
    writeDistance: (record) => settle(() => plugin.writeDistance(record)),
    deleteAmount: (type, clientRecordId) =>
      settle(() => plugin.deleteAmount({ type, clientRecordId })),
  };
}

/**
 * Test hook for the web build: end-to-end tests define `window.__kalethraHealthExport` with a
 * fake store. Never used on devices.
 */
interface ExportHookWindow {
  __kalethraHealthExport?: HealthExportPlatform;
}

/** No health store to write to (browser, iOS in this phase). */
export function createUnavailableExportPlatform(): HealthExportPlatform {
  const hook = (window as ExportHookWindow).__kalethraHealthExport;
  if (hook) return hook;
  return {
    availability: () => Promise.resolve({ kind: 'unsupported' }),
    checkWriteAccess: () => Promise.resolve(NO_WRITE_ACCESS),
    requestWriteAccess: () => Promise.resolve(NO_WRITE_ACCESS),
    writeExerciseSession: () => Promise.reject(new HealthExportError('unavailable')),
    writeActiveCalories: () => Promise.reject(new HealthExportError('unavailable')),
    writeDistance: () => Promise.reject(new HealthExportError('unavailable')),
    deleteAmount: () => Promise.reject(new HealthExportError('unavailable')),
  };
}

/** Health Connect on Android; nothing on iOS (no HealthKit in this phase) or the web. */
export function createHealthExportPlatform(): HealthExportPlatform {
  return getPlatform() === 'android'
    ? createAndroidExportPlatform()
    : createUnavailableExportPlatform();
}
