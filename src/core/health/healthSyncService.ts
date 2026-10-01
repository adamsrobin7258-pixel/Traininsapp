import type { DatabaseDriver } from '@/core/database';
import {
  HEALTH_DATA_KINDS,
  HealthPlatformError,
  type HealthDataKind,
  type HealthPlatform,
  type HealthPlatformId,
} from '@/core/platform/health';
import type { Clock } from '@/shared/lib/clock';
import { toLocalDateKey } from '@/shared/lib/date';
import {
  HealthConnectionRepository,
  type HealthConnectionState,
  type HealthSyncResult,
} from './healthConnectionRepository';
import {
  AUTO_SYNC_INTERVAL_MS,
  dailyTotals,
  earliestWeightPerDay,
  IMPORTED_KINDS,
  syncWindow,
  type ActivityDay,
  type DailyActivity,
  type ImportedKind,
  type ImportedWeight,
  type ImportedWeightDay,
  type SyncWindow,
} from './importedHealth';
import { ImportedHealthRepository } from './importedHealthRepository';

/** What the settings screen shows. "Syncing" is added by the provider while a sync runs. */
export type HealthConnectionStatus =
  /** No Health Connect on this device or platform. */
  | { state: 'unsupported' }
  /** Health Connect missing or outdated (Android 13 and lower). */
  | { state: 'needsInstall' }
  | { state: 'disconnected' }
  /** Turned on, but access to every imported kind is missing (denied or revoked). */
  | { state: 'permissionRequired'; lastSuccessAt: string | null }
  | {
      state: 'connected';
      lastSuccessAt: string | null;
      lastResult: HealthSyncResult | null;
      missing: ImportedKind[];
    };

export type SyncOutcome =
  | { kind: 'disabled' }
  /** Automatic sync within 15 minutes of the last attempt. */
  | { kind: 'skipped' }
  | { kind: 'done'; result: HealthSyncResult };

export type ConnectOutcome =
  | { kind: 'connected'; result: HealthSyncResult }
  /** The user granted none of the imported kinds; the integration stays off. */
  | { kind: 'denied' }
  | { kind: 'unavailable'; needsInstall: boolean }
  | { kind: 'failed' };

type KindRead =
  | { kind: 'weight'; ok: true; days: ImportedWeightDay[] }
  | { kind: 'steps' | 'activeEnergy'; ok: true; days: ActivityDay[] }
  | { kind: ImportedKind; ok: false; permission: boolean };

const isImported = (kind: HealthDataKind): kind is ImportedKind =>
  (IMPORTED_KINDS as readonly HealthDataKind[]).includes(kind);

/**
 * Imports weight, steps and active energy of the last 30 days from Health Connect.
 *
 * Rules (docs/HEALTH_CONNECT.md):
 * - Off by default; only `connect` (after the user's explicit choice) turns it on.
 * - Imported data goes to its own tables and never changes `weight_entries` – nutrition goals,
 *   which follow the user's own weight, stay unaffected.
 * - Every sync re-reads the whole 30-day window. New and changed values are stored; values
 *   the platform no longer returns are removed – but only after a complete, successful read of
 *   every permitted kind. Anything less (error, revoked access) never deletes.
 * - Automatic syncs run at most every 15 minutes; manual syncs always run. One sync at a time.
 */
export class HealthSyncService {
  readonly platformId: HealthPlatformId = 'healthConnect';
  private running: Promise<SyncOutcome> | null = null;

  constructor(
    private readonly platform: HealthPlatform,
    private readonly db: DatabaseDriver,
    private readonly clock: Clock,
  ) {}

  private get connection() {
    return new HealthConnectionRepository(this.db);
  }

  private get repository() {
    return new ImportedHealthRepository(this.db);
  }

  async status(): Promise<HealthConnectionStatus> {
    const availability = await this.platform.availability();
    if (availability.kind === 'unsupported') return { state: 'unsupported' };
    if (availability.kind === 'needsInstall') return { state: 'needsInstall' };
    const state = await this.connection.load();
    if (!state.enabled) return { state: 'disconnected' };
    if (state.lastResult === 'permission') {
      return { state: 'permissionRequired', lastSuccessAt: state.lastSuccessAt };
    }
    return {
      state: 'connected',
      lastSuccessAt: state.lastSuccessAt,
      lastResult: state.lastResult,
      missing: state.missing.filter(isImported),
    };
  }

  /**
   * Asks Health Connect for read access (after Kalethra's own explanation) and, if at least one
   * imported kind is granted, turns the integration on and runs the first import.
   */
  async connect(profileId: string): Promise<ConnectOutcome> {
    const availability = await this.platform.availability();
    if (availability.kind !== 'available') {
      return { kind: 'unavailable', needsInstall: availability.kind === 'needsInstall' };
    }
    let granted: HealthDataKind[];
    try {
      granted = (await this.platform.requestAccess(HEALTH_DATA_KINDS)).granted;
    } catch {
      return { kind: 'failed' };
    }
    if (!granted.some(isImported)) return { kind: 'denied' };
    const now = this.clock().toISOString();
    const current = await this.connection.load();
    await this.connection.save({ ...current, enabled: true, lastAttemptAt: null }, now);
    const outcome = await this.sync(profileId, { manual: true });
    return { kind: 'connected', result: outcome.kind === 'done' ? outcome.result : 'failed' };
  }

  /** Runs a sync; automatic ones are throttled to one per 15 minutes. */
  sync(profileId: string, { manual }: { manual: boolean }): Promise<SyncOutcome> {
    if (this.running) return this.running;
    const run = this.runSync(profileId, manual).finally(() => {
      this.running = null;
    });
    this.running = run;
    return run;
  }

  /**
   * Turns the integration off. With `deleteImported`, only the data imported from Health
   * Connect is removed – Kalethra's own weights, workouts and nutrition stay. Health Connect
   * keeps its permission list; the user can revoke access there (see `openSettings`).
   */
  async disconnect(
    profileId: string,
    { deleteImported }: { deleteImported: boolean },
  ): Promise<void> {
    await this.running?.catch(() => undefined);
    const now = this.clock().toISOString();
    await this.db.transaction(async (tx) => {
      if (deleteImported)
        await new ImportedHealthRepository(tx).deleteAll(profileId, this.platformId);
      const state = await new HealthConnectionRepository(tx).load();
      await new HealthConnectionRepository(tx).save(
        { ...state, enabled: false, lastResult: null, missing: [] },
        now,
      );
    });
  }

  openSettings(): Promise<void> {
    return this.platform.openSettings();
  }

  weightsBetween(profileId: string, from: string, to: string): Promise<ImportedWeight[]> {
    return this.repository.listWeights(profileId, from, to);
  }

  latestWeight(profileId: string): Promise<ImportedWeight | null> {
    return this.repository.latestWeight(profileId, toLocalDateKey(this.clock()));
  }

  activityBetween(profileId: string, from: string, to: string): Promise<DailyActivity[]> {
    return this.repository.listActivity(profileId, from, to);
  }

  hasImportedData(profileId: string): Promise<boolean> {
    return this.repository.hasData(profileId);
  }

  private async runSync(profileId: string, manual: boolean): Promise<SyncOutcome> {
    const state = await this.connection.load();
    if (!state.enabled) return { kind: 'disabled' };
    const now = this.clock();
    if (
      !manual &&
      state.lastAttemptAt &&
      now.getTime() - Date.parse(state.lastAttemptAt) < AUTO_SYNC_INTERVAL_MS
    ) {
      return { kind: 'skipped' };
    }
    const nowIso = now.toISOString();
    const finish = async (
      result: HealthSyncResult,
      patch: Partial<HealthConnectionState> = {},
    ): Promise<SyncOutcome> => {
      await this.connection.save(
        { ...state, ...patch, lastAttemptAt: nowIso, lastResult: result },
        nowIso,
      );
      return { kind: 'done', result };
    };

    try {
      const availability = await this.platform.availability();
      if (availability.kind !== 'available') return await finish('unavailable');

      const access = await this.platform.checkAccess(IMPORTED_KINDS);
      const permitted = access.granted.filter(isImported);
      if (permitted.length === 0)
        return await finish('permission', { missing: [...IMPORTED_KINDS] });

      const window = syncWindow(now);
      const reads = await Promise.all(permitted.map((kind) => this.read(kind, window, now)));
      const missing = [
        ...IMPORTED_KINDS.filter((kind) => !permitted.includes(kind)),
        ...reads.filter((read) => !read.ok && read.permission).map((read) => read.kind),
      ];
      if (reads.every((read) => !read.ok && read.permission)) {
        return await finish('permission', { missing });
      }
      // Removing values requires a complete picture: every permitted kind read successfully.
      const complete = reads.every((read) => read.ok);

      await this.db.transaction(async (tx) => {
        const repository = new ImportedHealthRepository(tx);
        for (const read of reads) {
          if (!read.ok) continue;
          if (read.kind === 'weight') {
            await repository.upsertWeights(profileId, this.platformId, read.days, nowIso);
            if (complete) {
              await repository.removeWeightsMissingFrom(
                profileId,
                this.platformId,
                window,
                read.days,
              );
            }
          } else {
            await repository.upsertActivity(
              profileId,
              this.platformId,
              read.kind,
              read.days,
              nowIso,
            );
            if (complete) {
              await repository.clearActivityMissingFrom(
                profileId,
                this.platformId,
                read.kind,
                window,
                read.days,
                nowIso,
              );
            }
          }
        }
      });

      if (!complete && reads.some((read) => !read.ok && !read.permission)) {
        return await finish('failed', { missing });
      }
      return await finish(missing.length > 0 ? 'partial' : 'ok', {
        missing,
        lastSuccessAt: nowIso,
      });
    } catch {
      // Platform or database failure: the transaction rolled back, stored data is unchanged.
      try {
        return await finish('failed');
      } catch {
        return { kind: 'done', result: 'failed' };
      }
    }
  }

  private async read(kind: ImportedKind, window: SyncWindow, now: Date): Promise<KindRead> {
    const range = { start: window.start, end: window.end };
    try {
      if (kind === 'weight') {
        const samples = await this.platform.readWeights(range);
        return { kind, ok: true, days: earliestWeightPerDay(samples, window, now) };
      }
      const totals = await this.platform.readDailyTotals(kind, range);
      return { kind, ok: true, days: dailyTotals(totals, kind, window) };
    } catch (error) {
      return {
        kind,
        ok: false,
        permission: error instanceof HealthPlatformError && error.code === 'permission',
      };
    }
  }
}
