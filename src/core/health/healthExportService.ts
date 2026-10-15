import type { SqlExecutor } from '@/core/database';
import {
  HealthExportError,
  type HealthExportPlatform,
  type HealthExportSession,
} from '@/core/platform/health';
import type { Clock } from '@/shared/lib/clock';
import { addDays, toLocalDateKey } from '@/shared/lib/date';
import {
  activitySession,
  clientRecordId,
  workoutSession,
  type ExportableActivity,
  type ExportableWorkout,
  type ExportSourceKind,
} from './healthExport';
import {
  HealthExportRepository,
  type HealthExportRecord,
  type HealthExportSetting,
} from './healthExportRepository';

/** Where the export reads Kalethra's own records – the existing services, no SQL of its own. */
export interface HealthExportSources {
  workout(profileId: string, id: string): Promise<ExportableWorkout | null>;
  /** Completed workouts that started on or after a local day. */
  workoutsSince(profileId: string, fromLocalDate: string): Promise<ExportableWorkout[]>;
  activity(profileId: string, id: string): Promise<ExportableActivity | null>;
  activitiesBetween(profileId: string, from: string, to: string): Promise<ExportableActivity[]>;
}

/** What the settings screen shows. */
export type HealthExportAccess =
  /** Health Connect is there and Kalethra may write. */
  | 'granted'
  /** Health Connect is there, the write permission is missing or was revoked. */
  | 'missing'
  /** Health Connect must be installed or updated. */
  | 'needsInstall'
  /** No Health Connect on this device or platform. */
  | 'unsupported';

export interface HealthExportState {
  enabled: boolean;
  access: HealthExportAccess;
  lastSuccessAt: string | null;
  /** Records waiting for a retry (pending or failed). */
  waiting: number;
}

export type EnableResult = 'enabled' | 'denied' | 'needsInstall' | 'unsupported';

/** What happened to one record. Never an exception: the export must not break anything. */
export type ExportOutcome =
  | 'exported'
  /** Already written in this version – nothing sent. */
  | 'unchanged'
  | 'skipped'
  | 'failed'
  /** The export is off – nothing sent, nothing noted. */
  | 'off'
  /** The record does not exist (anymore). */
  | 'gone';

export interface ExportOptions {
  /** Write only when the record was handled by the export before (edits). */
  onlyKnown?: boolean;
}

/** The catch-up when the export is turned on: the last 30 days including today. */
export const EXPORT_CATCH_UP_DAYS = 30;
/** At most this many waiting records are retried per run. */
const RETRY_BATCH = 50;

/**
 * The optional export of Kalethra's own workouts and manual activities to Health Connect
 * (Settings → App → Health Connect). Off by default and only on after the user turned it on and
 * Health Connect granted the write permission.
 *
 * - **When:** right after a workout is finished or an activity is saved (`exportWorkout`,
 *   `exportActivity`); once when turned on, for the last 30 days; on app start and return to the
 *   foreground only the records that are still waiting (`retryWaiting`) – never the history.
 * - **No duplicates:** every record has a stable client record ID ("kalethra:workout:<id>"), so
 *   Health Connect updates instead of adding; and `health_connect_exports` notes the version
 *   written, so an unchanged record is not sent again – after a restart, a reopened workout or
 *   turning the export off and on.
 * - **Never in the way:** errors are noted per record and retried later; nothing is thrown to the
 *   caller. A workout is saved before the export starts and stays saved whatever happens here.
 * - **Off means off:** nothing is written, nothing is deleted – neither in Kalethra nor in Health
 *   Connect.
 */
export class HealthExportService {
  private readonly repository: HealthExportRepository;
  /** One export at a time: records are written one after another, never twice in parallel. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly platform: HealthExportPlatform,
    db: SqlExecutor,
    private readonly sources: HealthExportSources,
    private readonly clock: Clock,
  ) {
    this.repository = new HealthExportRepository(db);
  }

  private now(): string {
    return this.clock().toISOString();
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work, work);
    this.queue = run.catch(() => undefined);
    return run;
  }

  setting(): Promise<HealthExportSetting> {
    return this.repository.loadSetting();
  }

  async access(): Promise<HealthExportAccess> {
    const availability = await this.platform.availability();
    if (availability.kind === 'needsInstall') return 'needsInstall';
    if (availability.kind !== 'available') return 'unsupported';
    return (await this.platform.checkWriteAccess()) ? 'granted' : 'missing';
  }

  async state(profileId: string): Promise<HealthExportState> {
    const [setting, access, counts, lastSuccessAt] = await Promise.all([
      this.repository.loadSetting(),
      this.access(),
      this.repository.countByStatus(profileId),
      this.repository.lastSuccessAt(profileId),
    ]);
    return {
      enabled: setting.enabled,
      access,
      lastSuccessAt,
      waiting: counts.pending + counts.failed,
    };
  }

  /**
   * Turns the export on: Health Connect must be there and grant the write permission – only then
   * is the switch stored as on. Afterwards the last 30 days are written once (already written
   * records are skipped). A refusal leaves everything off, without an error.
   */
  async enable(profileId: string): Promise<{ result: EnableResult; exported: number }> {
    const availability = await this.platform.availability();
    if (availability.kind === 'needsInstall') return { result: 'needsInstall', exported: 0 };
    if (availability.kind !== 'available') return { result: 'unsupported', exported: 0 };
    const granted =
      (await this.platform.checkWriteAccess()) || (await this.platform.requestWriteAccess());
    if (!granted) return { result: 'denied', exported: 0 };
    await this.repository.saveSetting({ enabled: true, enabledAt: this.now() }, this.now());
    const exported = await this.catchUp(profileId);
    return { result: 'enabled', exported };
  }

  /** Turns the export off. Nothing is deleted – not in Kalethra, not in Health Connect. */
  async disable(): Promise<void> {
    const setting = await this.repository.loadSetting();
    await this.repository.saveSetting({ ...setting, enabled: false }, this.now());
  }

  /**
   * Writes one finished workout (or its new version). Safe to call any number of times.
   * `onlyKnown`: after an edit – only a record the export already knows is written again, so
   * correcting an old workout never exports history by the back door.
   */
  exportWorkout(
    profileId: string,
    workoutId: string,
    options: ExportOptions = {},
  ): Promise<ExportOutcome> {
    return this.serial(() => this.exportOne(profileId, 'workout', workoutId, options));
  }

  /** Writes one saved manual activity (or its new version). Safe to call any number of times. */
  exportActivity(
    profileId: string,
    activityId: string,
    options: ExportOptions = {},
  ): Promise<ExportOutcome> {
    return this.serial(() => this.exportOne(profileId, 'activity', activityId, options));
  }

  /**
   * Retries the records still waiting (pending or failed) – on app start and return to the
   * foreground. Without the permission nothing is tried (no request per record).
   */
  retryWaiting(profileId: string): Promise<number> {
    return this.serial(async () => {
      if (!(await this.repository.loadSetting()).enabled) return 0;
      if ((await this.access()) !== 'granted') return 0;
      let exported = 0;
      for (const record of await this.repository.retryable(profileId, RETRY_BATCH)) {
        const outcome = await this.exportOne(profileId, record.sourceKind, record.sourceId);
        if (outcome === 'exported') exported += 1;
        if (outcome === 'failed') break; // still failing – try again next time, not 50 times now
      }
      return exported;
    });
  }

  /** The last 30 days, once when turned on. Already written records are not sent again. */
  private catchUp(profileId: string): Promise<number> {
    return this.serial(async () => {
      const today = toLocalDateKey(this.clock());
      const from = toLocalDateKey(addDays(this.clock(), -(EXPORT_CATCH_UP_DAYS - 1)));
      const [workouts, activities] = await Promise.all([
        this.sources.workoutsSince(profileId, from).catch(() => []),
        this.sources.activitiesBetween(profileId, from, today).catch(() => []),
      ]);
      let exported = 0;
      const items: [ExportSourceKind, string][] = [
        ...workouts.map((w): [ExportSourceKind, string] => ['workout', w.id]),
        ...activities.map((a): [ExportSourceKind, string] => ['activity', a.id]),
      ];
      for (const [kind, id] of items) {
        const outcome = await this.exportOne(profileId, kind, id);
        if (outcome === 'exported') exported += 1;
      }
      return exported;
    });
  }

  private async exportOne(
    profileId: string,
    kind: ExportSourceKind,
    sourceId: string,
    { onlyKnown = false }: ExportOptions = {},
  ): Promise<ExportOutcome> {
    try {
      if (!(await this.repository.loadSetting()).enabled) return 'off';
      if (onlyKnown && !(await this.repository.find(profileId, kind, sourceId))) {
        return 'unchanged';
      }
      const source =
        kind === 'workout'
          ? await this.sources.workout(profileId, sourceId)
          : await this.sources.activity(profileId, sourceId);
      if (!source) {
        await this.repository.remove(profileId, kind, sourceId);
        return 'gone';
      }
      const built =
        kind === 'workout'
          ? workoutSession(source as ExportableWorkout)
          : activitySession(source as ExportableActivity);
      const previous = await this.repository.find(profileId, kind, sourceId);
      const base: HealthExportRecord = previous ?? {
        profileId,
        sourceKind: kind,
        sourceId,
        clientRecordId: clientRecordId(kind, sourceId),
        status: 'pending',
        exportedVersion: null,
        attempts: 0,
        lastError: null,
        lastAttemptAt: null,
        lastSuccessAt: null,
      };
      if ('skip' in built) {
        await this.repository.save(
          { ...base, status: 'skipped', lastError: built.skip },
          this.now(),
        );
        return 'skipped';
      }
      if (
        previous?.status === 'exported' &&
        (previous.exportedVersion ?? -1) >= built.session.clientRecordVersion
      ) {
        return 'unchanged';
      }
      return await this.write(base, built.session);
    } catch {
      // Bookkeeping itself failed (e.g. the database is busy): the record stays as it was and
      // the next trigger tries again. Nothing reaches the caller.
      return 'failed';
    }
  }

  private async write(base: HealthExportRecord, session: HealthExportSession) {
    const attemptAt = this.now();
    // Noted before the write: if the app stops in between, the record is retried later.
    const pending: HealthExportRecord = {
      ...base,
      status: base.status === 'exported' ? 'pending' : base.status,
      attempts: base.attempts + 1,
      lastAttemptAt: attemptAt,
    };
    await this.repository.save(pending, attemptAt);
    try {
      await this.platform.writeExerciseSession(session);
    } catch (error) {
      const code = error instanceof HealthExportError ? error.code : 'failed';
      await this.repository.save(
        { ...pending, status: code === 'invalid' ? 'skipped' : 'failed', lastError: code },
        this.now(),
      );
      return code === 'invalid' ? 'skipped' : 'failed';
    }
    const at = this.now();
    await this.repository.save(
      {
        ...pending,
        status: 'exported',
        exportedVersion: session.clientRecordVersion,
        lastError: null,
        lastSuccessAt: at,
      },
      at,
    );
    return 'exported';
  }
}
