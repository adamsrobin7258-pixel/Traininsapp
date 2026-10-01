import { Health, type HealthDataType } from '@capgo/capacitor-health';
import {
  HealthPlatformError,
  type HealthAccess,
  type HealthAvailability,
  type HealthDataKind,
  type HealthPlatform,
} from './types';

/** Kalethra's kinds → the plugin's data types (`calories` is active energy on Android). */
const PLUGIN_TYPES: Record<HealthDataKind, HealthDataType> = {
  weight: 'weight',
  steps: 'steps',
  activeEnergy: 'calories',
  exercise: 'workouts',
  distance: 'distance',
};

/** Kalethra writes nothing to Health Connect; anything attributed to it is skipped anyway. */
const OWN_PACKAGE = 'com.kalethra.app';

function toAccess(
  kinds: readonly HealthDataKind[],
  result: { readAuthorized: HealthDataType[] },
): HealthAccess {
  const granted = kinds.filter((kind) => result.readAuthorized.includes(PLUGIN_TYPES[kind]));
  return { granted, denied: kinds.filter((kind) => !granted.includes(kind)) };
}

function readOptions(kinds: readonly HealthDataKind[]) {
  // Read only. No write scopes and no history access (reads stay within the last 30 days).
  return { read: kinds.map((kind) => PLUGIN_TYPES[kind]) };
}

/** Plugin errors carry only a message; anything mentioning permissions is a permission error. */
function classify(error: unknown): HealthPlatformError {
  if (error instanceof HealthPlatformError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/permission|security|not authori[sz]ed/i.test(message)) {
    return new HealthPlatformError('permission', message);
  }
  if (/unavailable|not installed|needs an update/i.test(message)) {
    return new HealthPlatformError('unavailable', message);
  }
  return new HealthPlatformError('failed', message);
}

async function call<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw classify(error);
  }
}

/**
 * Android Health Connect through `@capgo/capacitor-health`. The plugin's manifest declares many
 * more permissions; the app manifest removes all but four read permissions (see
 * android/app/src/main/AndroidManifest.xml). Everything stays on the device – the plugin makes
 * no network requests.
 */
export function createHealthConnectPlatform(): HealthPlatform {
  return {
    async availability(): Promise<HealthAvailability> {
      try {
        const result = await Health.isAvailable();
        if (result.available) return { kind: 'available', platform: 'healthConnect' };
        // "Health Connect needs an update." – also reported when it is not installed.
        return /update/i.test(result.reason ?? '')
          ? { kind: 'needsInstall' }
          : { kind: 'unsupported' };
      } catch {
        return { kind: 'unsupported' };
      }
    },
    checkAccess: (kinds) =>
      call(async () => toAccess(kinds, await Health.checkAuthorization(readOptions(kinds)))),
    requestAccess: (kinds) =>
      call(async () => toAccess(kinds, await Health.requestAuthorization(readOptions(kinds)))),
    readWeights: (range) =>
      call(async () => {
        // limit 0 = every record in the range (the plugin pages through all of them).
        const { samples } = await Health.readSamples({
          dataType: 'weight',
          startDate: range.start,
          endDate: range.end,
          limit: 0,
          ascending: true,
        });
        return samples.map((sample) => ({
          id: sample.platformId ?? null,
          measuredAt: sample.startDate,
          kg: sample.value,
          source: sample.sourceName ?? sample.sourceId ?? null,
        }));
      }),
    readDailyTotals: (kind, range) =>
      call(async () => {
        // Health Connect aggregates per local day and de-duplicates overlapping sources.
        const { samples } = await Health.queryAggregated({
          dataType: PLUGIN_TYPES[kind],
          startDate: range.start,
          endDate: range.end,
          bucket: 'day',
          aggregation: 'sum',
        });
        return samples.map((sample) => ({ dayStart: sample.startDate, value: sample.value }));
      }),
    readWorkouts: (range) =>
      call(async () => {
        // limit 0 = every session in the range (the plugin pages through all of them). Energy
        // and distance are aggregated by Health Connect over the session time.
        const { workouts } = await Health.queryWorkouts({
          startDate: range.start,
          endDate: range.end,
          limit: 0,
          ascending: true,
        });
        return workouts.flatMap((workout) =>
          workout.platformId && workout.sourceId !== OWN_PACKAGE
            ? [
                {
                  id: workout.platformId,
                  type: workout.workoutType,
                  start: workout.startDate,
                  end: workout.endDate,
                  activeKcal: workout.totalEnergyBurned ?? null,
                  distanceM: workout.totalDistance ?? null,
                  source: workout.sourceName ?? workout.sourceId ?? null,
                },
              ]
            : [],
        );
      }),
    openSettings: () => call(() => Health.openHealthConnectSettings()),
  };
}
