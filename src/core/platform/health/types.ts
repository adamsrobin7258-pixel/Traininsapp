/**
 * Platform boundary for reading health data (Android Health Connect; Apple Health later).
 *
 *   core/health (sync, storage, rules)  →  HealthPlatform (this file)  →  platform adapter
 *                                                                          ├─ Android: Health Connect
 *                                                                          └─ web/tests: unavailable or fake
 *
 * Domain code depends only on these types, never on Capacitor or the plugin. Read-only: no
 * adapter writes anything into the platform's health store. Units are normalised here:
 * kilograms, step counts, kilocalories; times as ISO-8601 UTC.
 */

/** Platforms with a health store. Stored with every imported value. */
export type HealthPlatformId = 'healthConnect';

/** Data Kalethra asks to read. `exercise` is requested now, imported only in a later phase. */
export const HEALTH_DATA_KINDS = ['weight', 'steps', 'activeEnergy', 'exercise'] as const;
export type HealthDataKind = (typeof HEALTH_DATA_KINDS)[number];

export type HealthAvailability =
  | { kind: 'available'; platform: HealthPlatformId }
  /** Health Connect missing or outdated (Android 13 and lower): install/update from Play. */
  | { kind: 'needsInstall' }
  /** No health store on this device or platform (web, iOS in this phase, old Android). */
  | { kind: 'unsupported' };

export interface HealthAccess {
  granted: HealthDataKind[];
  denied: HealthDataKind[];
}

/** Half-open time range [start, end) as ISO-8601 UTC. */
export interface HealthTimeRange {
  start: string;
  end: string;
}

/** One body weight measurement. */
export interface HealthWeightSample {
  /** The platform's record ID (Health Connect metadata ID). */
  id: string | null;
  measuredAt: string;
  kg: number;
  /** App or device that recorded it, e.g. "com.withings.wiscale2" or "Withings Body+". */
  source: string | null;
}

/**
 * Total of one local calendar day, aggregated by the platform: values recorded by several apps
 * or devices (phone and watch) are de-duplicated there, not summed by Kalethra.
 */
export interface HealthDailyTotal {
  /** Start of the local day as ISO-8601 UTC. */
  dayStart: string;
  value: number;
}

export type HealthPlatformErrorCode =
  /** The health store is not available (anymore). */
  | 'unavailable'
  /** Access to the requested data is missing or was revoked. */
  | 'permission'
  /** Any other failure of the platform or the plugin. */
  | 'failed';

export class HealthPlatformError extends Error {
  constructor(
    readonly code: HealthPlatformErrorCode,
    message?: string,
  ) {
    super(message ?? `Health platform error: ${code}`);
    this.name = 'HealthPlatformError';
  }
}

export interface HealthPlatform {
  availability(): Promise<HealthAvailability>;
  /** Current access without asking the user. */
  checkAccess(kinds: readonly HealthDataKind[]): Promise<HealthAccess>;
  /** Shows the platform's permission dialog for these kinds. */
  requestAccess(kinds: readonly HealthDataKind[]): Promise<HealthAccess>;
  /** Every weight measurement in the range, all sources. */
  readWeights(range: HealthTimeRange): Promise<HealthWeightSample[]>;
  /** One total per local day that has data. */
  readDailyTotals(
    kind: 'steps' | 'activeEnergy',
    range: HealthTimeRange,
  ): Promise<HealthDailyTotal[]>;
  /** Opens the platform's permission management (Health Connect settings). */
  openSettings(): Promise<void>;
}
