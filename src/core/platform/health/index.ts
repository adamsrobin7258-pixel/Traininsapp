import { getPlatform } from '../platform';
import { createHealthConnectPlatform } from './healthConnect';
import type { HealthPlatform } from './types';
import { createUnavailableHealthPlatform } from './unavailable';

export * from './types';
export {
  createHealthExportPlatform,
  createUnavailableExportPlatform,
  HEALTH_EXERCISE_TYPES,
  HEALTH_WRITE_TYPES,
  HealthExportError,
  NO_WRITE_ACCESS,
  type HealthExerciseType,
  type HealthExportCalories,
  type HealthExportDistance,
  type HealthExportErrorCode,
  type HealthExportPlatform,
  type HealthExportSession,
  type HealthWriteAccess,
  type HealthWriteType,
} from './export';

/** The device's health store: Health Connect on Android, nothing elsewhere (yet). */
export function createHealthPlatform(): HealthPlatform {
  return getPlatform() === 'android'
    ? createHealthConnectPlatform()
    : createUnavailableHealthPlatform();
}
