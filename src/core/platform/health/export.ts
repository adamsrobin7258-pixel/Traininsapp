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
 * Only the type and the times of a session are written – no title, notes or calories.
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
  /** Whether Kalethra may write exercise sessions, without asking. */
  checkWriteAccess(): Promise<boolean>;
  /** Shows the platform's permission dialog for writing exercise sessions; the result is checked again. */
  requestWriteAccess(): Promise<boolean>;
  /** Writes (inserts or updates) one session; throws `HealthExportError`. */
  writeExerciseSession(session: HealthExportSession): Promise<void>;
}

interface NativeExportPlugin {
  availability(): Promise<{ status: 'available' | 'needsInstall' | 'unsupported' }>;
  checkWriteAccess(): Promise<{ granted: boolean }>;
  requestWriteAccess(): Promise<{ granted: boolean }>;
  writeExerciseSession(session: HealthExportSession): Promise<{ written: boolean }>;
}

const CODES: readonly HealthExportErrorCode[] = ['unavailable', 'permission', 'invalid', 'failed'];

function toExportError(error: unknown): HealthExportError {
  if (error instanceof HealthExportError) return error;
  const code = (error as { code?: unknown } | null)?.code;
  return new HealthExportError(CODES.find((known) => known === code) ?? 'failed');
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
        return (await plugin.checkWriteAccess()).granted;
      } catch {
        return false;
      }
    },
    async requestWriteAccess() {
      try {
        return (await plugin.requestWriteAccess()).granted;
      } catch {
        return false;
      }
    },
    async writeExerciseSession(session) {
      try {
        await plugin.writeExerciseSession(session);
      } catch (error) {
        throw toExportError(error);
      }
    },
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
    checkWriteAccess: () => Promise.resolve(false),
    requestWriteAccess: () => Promise.resolve(false),
    writeExerciseSession: () => Promise.reject(new HealthExportError('unavailable')),
  };
}

/** Health Connect on Android; nothing on iOS (no HealthKit in this phase) or the web. */
export function createHealthExportPlatform(): HealthExportPlatform {
  return getPlatform() === 'android'
    ? createAndroidExportPlatform()
    : createUnavailableExportPlatform();
}
