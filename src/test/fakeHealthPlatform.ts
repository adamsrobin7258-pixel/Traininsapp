import {
  HEALTH_DATA_KINDS,
  HealthPlatformError,
  type HealthAccess,
  type HealthAvailability,
  type HealthDailyTotal,
  type HealthDataKind,
  type HealthPlatform,
  type HealthTimeRange,
  type HealthWeightSample,
} from '@/core/platform/health';

type ReadKind = 'weight' | 'steps' | 'activeEnergy';

/**
 * In-memory Health Connect for tests. Holds weights and daily totals, grants or denies
 * access per kind, fails reads on demand and can hold a read open to observe "syncing".
 */
export class FakeHealthPlatform implements HealthPlatform {
  available: HealthAvailability = { kind: 'available', platform: 'healthConnect' };
  /** Kinds currently granted (as Health Connect reports them). */
  granted = new Set<HealthDataKind>();
  /** What the user grants in the permission dialog; `null` keeps the current grants. */
  grantOnRequest: readonly HealthDataKind[] | null = HEALTH_DATA_KINDS;
  weights: HealthWeightSample[] = [];
  steps: HealthDailyTotal[] = [];
  activeEnergy: HealthDailyTotal[] = [];
  failures = new Map<ReadKind, HealthPlatformError>();
  /** While set, every read waits for it. */
  gate: Promise<void> | null = null;
  calls = { request: 0, check: 0, reads: 0, openSettings: 0 };
  readonly ranges: HealthTimeRange[] = [];

  availability(): Promise<HealthAvailability> {
    return Promise.resolve(this.available);
  }

  private access(kinds: readonly HealthDataKind[]): HealthAccess {
    const granted = kinds.filter((kind) => this.granted.has(kind));
    return { granted, denied: kinds.filter((kind) => !this.granted.has(kind)) };
  }

  checkAccess(kinds: readonly HealthDataKind[]): Promise<HealthAccess> {
    this.calls.check++;
    return Promise.resolve(this.access(kinds));
  }

  requestAccess(kinds: readonly HealthDataKind[]): Promise<HealthAccess> {
    this.calls.request++;
    if (this.grantOnRequest) this.granted = new Set(this.grantOnRequest);
    return Promise.resolve(this.access(kinds));
  }

  private async read<T>(kind: ReadKind, range: HealthTimeRange, data: () => T): Promise<T> {
    this.calls.reads++;
    this.ranges.push(range);
    if (this.gate) await this.gate;
    const failure = this.failures.get(kind);
    if (failure) throw failure;
    if (!this.granted.has(kind)) throw new HealthPlatformError('permission');
    return data();
  }

  readWeights(range: HealthTimeRange): Promise<HealthWeightSample[]> {
    return this.read('weight', range, () =>
      this.weights.filter((w) => w.measuredAt >= range.start && w.measuredAt < range.end),
    );
  }

  readDailyTotals(
    kind: 'steps' | 'activeEnergy',
    range: HealthTimeRange,
  ): Promise<HealthDailyTotal[]> {
    return this.read(kind, range, () =>
      this[kind].filter((d) => d.dayStart >= range.start && d.dayStart < range.end),
    );
  }

  openSettings(): Promise<void> {
    this.calls.openSettings++;
    return Promise.resolve();
  }
}

/** ISO instant of a local time, e.g. `localIso(2026, 10, 3, 8, 2)` = 3 Oct 2026, 08:02. */
export function localIso(year: number, month: number, day: number, hour = 0, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}
