import type { SqlExecutor } from '@/core/database';
import {
  HealthExportError,
  type HealthExportPlatform,
  type HealthWriteAccess,
  type HealthWriteType,
} from '@/core/platform/health';
import type { Clock } from '@/shared/lib/clock';
import {
  activityExport,
  clientRecordId,
  EXPORT_AMOUNT_TYPES,
  EXPORT_RECORD_TYPES,
  workoutExport,
  type ExportableActivity,
  type ExportableWorkout,
  type ExportAmountType,
  type ExportPlan,
  type ExportRecordType,
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
  /** IDs of every completed workout – the whole history. */
  completedWorkoutIds(profileId: string): Promise<string[]>;
  activity(profileId: string, id: string): Promise<ExportableActivity | null>;
  /** IDs of every manual activity – the whole history. */
  activityIds(profileId: string): Promise<string[]>;
  /** Body weight (kg) for the calories of a workout on a day (weight rule 3); `null` without. */
  weightKgOn(profileId: string, localDate: string): Promise<number | null>;
}

/** What the settings screen shows. */
export type HealthExportAccess =
  /** Health Connect is there and Kalethra may write sessions, calories and distance. */
  | 'granted'
  /** Sessions may be written, calories and/or distance not (the user left them off). */
  | 'partial'
  /** Health Connect is there, the permission for sessions is missing or was revoked. */
  | 'missing'
  /** Health Connect must be installed or updated. */
  | 'needsInstall'
  /** No Health Connect on this device or platform. */
  | 'unsupported';

export interface HealthExportState {
  enabled: boolean;
  access: HealthExportAccess;
  lastSuccessAt: string | null;
  /** Records waiting for a retry (pending or failed) of the types Kalethra may write. */
  waiting: number;
  /** The one-time pass over the whole history is not finished yet. */
  historyPending: boolean;
}

export type EnableResult = 'enabled' | 'denied' | 'needsInstall' | 'unsupported';

/** What happened to one Kalethra record. Never an exception: the export must not break anything. */
export type ExportOutcome =
  /** At least one Health Connect record was written or one of Kalethra's own was deleted. */
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

/** What happened to one Health Connect record of a Kalethra record. */
type RecordResult = 'exported' | 'unchanged' | 'skipped' | 'failed' | 'waiting';

/** The write permission each record type needs. */
const PERMISSION: Readonly<Record<ExportRecordType, HealthWriteType>> = {
  session: 'exercise',
  calories: 'activeCalories',
  distance: 'distance',
};
/** Kalethra records per step of the history pass – other exports run in between. */
export const HISTORY_BATCH = 25;
/** Waiting records looked at per round of a retry. */
const RETRY_BATCH = 50;

/**
 * The optional export of Kalethra's own workouts and manual activities to Health Connect
 * (Settings → App → Health Connect). Off by default and only on after the user turned it on and
 * Health Connect granted at least the permission for exercise sessions.
 *
 * - **What:** per Kalethra record its exercise session and – only with a real value – its active
 *   calories and distance over the same span, each a record of its own with its own client
 *   record ID and bookkeeping row. A type without permission waits; it never blocks the others.
 * - **When:** right after a workout is finished or an activity is saved (`exportWorkout`,
 *   `exportActivity`); once over the whole history when turned on (`exportHistory`, in batches,
 *   resumed on the next start until done); on app start and return to the foreground the records
 *   still waiting (`retryWaiting`).
 * - **No duplicates:** stable client record IDs make Health Connect update instead of adding;
 *   `health_connect_exports` notes version and value written, so unchanged records are not sent
 *   again – after a restart, a reopened workout or turning the export off and on.
 * - **Removed values:** when an amount Kalethra had written is removed or becomes invalid, only
 *   Kalethra's own record with that client record ID is deleted in Health Connect.
 * - **Never in the way:** errors are noted per record and retried later; nothing is thrown to the
 *   caller. A workout is saved before the export starts and stays saved whatever happens here.
 * - **Off means off:** nothing is written, nothing is deleted – neither in Kalethra nor in Health
 *   Connect.
 */
export class HealthExportService {
  private readonly repository: HealthExportRepository;
  /** One export at a time: records are written one after another, never twice in parallel. */
  private queue: Promise<unknown> = Promise.resolve();
  /** The running history pass, if any – started at most once at a time. */
  private history: Promise<number> | null = null;

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

  /** The write permissions right now; `null` when Health Connect is not available. */
  private async writable(): Promise<HealthWriteAccess | null> {
    const availability = await this.platform.availability();
    if (availability.kind !== 'available') return null;
    return this.platform.checkWriteAccess();
  }

  async access(): Promise<HealthExportAccess> {
    const availability = await this.platform.availability();
    if (availability.kind === 'needsInstall') return 'needsInstall';
    if (availability.kind !== 'available') return 'unsupported';
    const granted = await this.platform.checkWriteAccess();
    if (!granted.exercise) return 'missing';
    return granted.activeCalories && granted.distance ? 'granted' : 'partial';
  }

  async state(profileId: string): Promise<HealthExportState> {
    const [setting, access, writable, lastSuccessAt] = await Promise.all([
      this.repository.loadSetting(),
      this.access(),
      this.writable().catch(() => null),
      this.repository.lastSuccessAt(profileId),
    ]);
    // Sessions always count; an amount the user left without permission is not "waiting".
    const counts = await this.repository.countByStatus(
      profileId,
      writable
        ? EXPORT_RECORD_TYPES.filter((type) => type === 'session' || writable[PERMISSION[type]])
        : undefined,
    );
    return {
      enabled: setting.enabled,
      access,
      lastSuccessAt,
      waiting: counts.pending + counts.failed,
      historyPending: setting.enabled && setting.historyDoneAt === null,
    };
  }

  /**
   * Turns the export on (or, when it is on, asks again for missing permissions): Health Connect
   * must be there and grant at least the permission for sessions – only then is the switch
   * stored as on. Calories and distance follow when their permission is granted too. The pass
   * over the whole history then runs in the background (`history`); already written records
   * are skipped. A refusal leaves everything off, without an error.
   */
  async enable(profileId: string): Promise<{ result: EnableResult; history: Promise<number> }> {
    const none = Promise.resolve(0);
    const availability = await this.platform.availability();
    if (availability.kind === 'needsInstall') return { result: 'needsInstall', history: none };
    if (availability.kind !== 'available') return { result: 'unsupported', history: none };
    let granted = await this.platform.checkWriteAccess();
    if (!granted.exercise || !granted.activeCalories || !granted.distance) {
      granted = await this.platform.requestWriteAccess();
    }
    if (!granted.exercise) return { result: 'denied', history: none };
    const setting = await this.repository.loadSetting();
    await this.repository.saveSetting(
      {
        enabled: true,
        enabledAt: setting.enabled ? setting.enabledAt : this.now(),
        // Again over the history: records changed while off, or types granted only now.
        historyDoneAt: null,
      },
      this.now(),
    );
    return { result: 'enabled', history: this.exportHistory(profileId) };
  }

  /** Turns the export off. Nothing is deleted – not in Kalethra, not in Health Connect. */
  async disable(): Promise<void> {
    const setting = await this.repository.loadSetting();
    await this.repository.saveSetting({ ...setting, enabled: false }, this.now());
  }

  /**
   * Writes one finished workout (or its new version). Safe to call any number of times.
   * `onlyKnown`: after an edit – only a record the export already knows is written again, so
   * correcting an old workout while the history pass is not done never exports out of order.
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
   * The one-time pass over the whole history (all completed workouts and manual activities):
   * in batches of `HISTORY_BATCH`, so exports of new workouts run in between and nothing waits
   * long. Unchanged records cost a lookup, nothing is sent twice. Marked done only when every
   * batch ran with the export still on – otherwise the next app start resumes it. A record that
   * fails waits for `retryWaiting`; it does not stop the pass. Never throws.
   */
  exportHistory(profileId: string): Promise<number> {
    this.history ??= this.runHistory(profileId).finally(() => {
      this.history = null;
    });
    return this.history;
  }

  private async runHistory(profileId: string): Promise<number> {
    try {
      const started = await this.repository.loadSetting();
      if (!started.enabled || started.historyDoneAt !== null) return 0;
      const items = await this.serial(async () => {
        const [workouts, activities] = await Promise.all([
          this.sources.completedWorkoutIds(profileId),
          this.sources.activityIds(profileId),
        ]);
        return [
          ...workouts.map((id): [ExportSourceKind, string] => ['workout', id]),
          ...activities.map((id): [ExportSourceKind, string] => ['activity', id]),
        ];
      });
      let exported = 0;
      for (let from = 0; from < items.length; from += HISTORY_BATCH) {
        const batch = items.slice(from, from + HISTORY_BATCH);
        const step = await this.serial(async () => {
          const writable = await this.writable();
          // Health Connect gone or the session permission revoked: resume on the next start.
          if (!writable?.exercise) return null;
          let written = 0;
          for (const [kind, id] of batch) {
            const outcome = await this.exportOne(profileId, kind, id, {}, writable);
            if (outcome === 'off') return null;
            if (outcome === 'exported') written += 1;
          }
          return written;
        });
        if (step === null) return exported;
        exported += step;
      }
      const current = await this.repository.loadSetting();
      if (current.enabled && current.historyDoneAt === null) {
        await this.repository.saveSetting({ ...current, historyDoneAt: this.now() }, this.now());
      }
      return exported;
    } catch {
      return 0;
    }
  }

  /**
   * On app start and return to the foreground: first the history pass if it is not done, then
   * the records still waiting (pending or failed) – only of the types Kalethra may write now,
   * each record once, stopping at the first one that still fails.
   */
  async retryWaiting(profileId: string): Promise<number> {
    try {
      const setting = await this.repository.loadSetting();
      if (!setting.enabled) return 0;
      const fromHistory = setting.historyDoneAt === null ? await this.exportHistory(profileId) : 0;
      const retried = await this.serial(async () => {
        const writable = await this.writable();
        if (!writable) return 0;
        const types = EXPORT_RECORD_TYPES.filter((type) => writable[PERMISSION[type]]);
        const seen = new Set<string>();
        let written = 0;
        for (;;) {
          const batch = (await this.repository.retryable(profileId, types, RETRY_BATCH)).filter(
            (record) => !seen.has(`${record.sourceKind}:${record.sourceId}`),
          );
          if (batch.length === 0) return written;
          for (const { sourceKind, sourceId } of batch) {
            seen.add(`${sourceKind}:${sourceId}`);
            const outcome = await this.exportOne(profileId, sourceKind, sourceId, {}, writable);
            if (outcome === 'exported') written += 1;
            // Still failing (or turned off): try again next time, not every record now.
            if (outcome === 'failed' || outcome === 'off') return written;
          }
        }
      });
      return fromHistory + retried;
    } catch {
      return 0;
    }
  }

  private async plan(
    profileId: string,
    kind: ExportSourceKind,
    sourceId: string,
  ): Promise<ExportPlan | null> {
    if (kind === 'activity') {
      const activity = await this.sources.activity(profileId, sourceId);
      return activity ? activityExport(activity) : null;
    }
    const workout = await this.sources.workout(profileId, sourceId);
    if (!workout) return null;
    const weightKg =
      workout.status === 'completed'
        ? await this.sources.weightKgOn(profileId, workout.localDate).catch(() => null)
        : null;
    return workoutExport(workout, weightKg);
  }

  /**
   * Everything of one Kalethra record: its session first, then each amount. `writable` is
   * passed by batch callers so the permissions are read once per batch.
   */
  private async exportOne(
    profileId: string,
    kind: ExportSourceKind,
    sourceId: string,
    { onlyKnown = false }: ExportOptions = {},
    writable?: HealthWriteAccess | null,
  ): Promise<ExportOutcome> {
    try {
      if (!(await this.repository.loadSetting()).enabled) return 'off';
      const rows = await this.repository.findAll(profileId, kind, sourceId);
      const row = (type: ExportRecordType) => rows.find((r) => r.recordType === type) ?? null;
      if (onlyKnown && !row('session')) return 'unchanged';
      const plan = await this.plan(profileId, kind, sourceId);
      if (!plan) {
        await this.repository.remove(profileId, kind, sourceId);
        return 'gone';
      }
      const base = (type: ExportRecordType): HealthExportRecord =>
        row(type) ?? {
          profileId,
          sourceKind: kind,
          sourceId,
          recordType: type,
          clientRecordId: clientRecordId(kind, sourceId, type),
          status: 'pending',
          exportedVersion: null,
          exportedValue: null,
          attempts: 0,
          lastError: null,
          lastAttemptAt: null,
          lastSuccessAt: null,
        };
      if ('skip' in plan) {
        await this.repository.save(
          { ...base('session'), status: 'skipped', lastError: plan.skip },
          this.now(),
        );
        // Amounts never sent are forgotten; ones already in Health Connect stay, like the session.
        for (const type of EXPORT_AMOUNT_TYPES) {
          const amount = row(type);
          if (amount && amount.exportedValue === null && amount.status !== 'removed') {
            await this.repository.removeType(profileId, kind, sourceId, type);
          }
        }
        return 'skipped';
      }
      const access = writable === undefined ? await this.writable() : writable;
      const results: RecordResult[] = [await this.syncSession(base('session'), plan, access)];
      for (const type of EXPORT_AMOUNT_TYPES) {
        results.push(await this.syncAmount(base(type), row(type), plan, type, access));
      }
      if (results.includes('failed')) return 'failed';
      if (results.includes('exported')) return 'exported';
      return results[0] === 'skipped' ? 'skipped' : 'unchanged';
    } catch {
      // Bookkeeping itself failed (e.g. the database is busy): the record stays as it was and
      // the next trigger tries again. Nothing reaches the caller.
      return 'failed';
    }
  }

  private syncSession(
    base: HealthExportRecord,
    plan: Extract<ExportPlan, { session: unknown }>,
    writable: HealthWriteAccess | null,
  ): Promise<RecordResult> {
    const { session } = plan;
    if (base.status === 'exported' && (base.exportedVersion ?? -1) >= session.clientRecordVersion) {
      return Promise.resolve('unchanged');
    }
    return this.attempt(base, writable, () => this.platform.writeExerciseSession(session), {
      status: 'exported',
      version: session.clientRecordVersion,
      value: null,
    });
  }

  /**
   * One amount of a session. A value is written when it is new or changed, or when the session
   * changed (its times); no value means no record – and a record Kalethra wrote earlier for a
   * value that is gone now is deleted (only that one, by its client record ID).
   */
  private async syncAmount(
    base: HealthExportRecord,
    previous: HealthExportRecord | null,
    plan: Extract<ExportPlan, { session: unknown }>,
    type: ExportAmountType,
    writable: HealthWriteAccess | null,
  ): Promise<RecordResult> {
    const value = plan.amounts[type];
    const sourceVersion = plan.session.clientRecordVersion;
    // Above the last version written, so Health Connect always takes the newer one.
    const version = Math.max(sourceVersion, (previous?.exportedVersion ?? -1) + 1);
    if (value === null) {
      if (!previous || previous.status === 'removed') return 'unchanged';
      if (previous.attempts === 0) {
        // Never sent (it waited for a permission): nothing of it is in Health Connect.
        await this.repository.removeType(base.profileId, base.sourceKind, base.sourceId, type);
        return 'unchanged';
      }
      const kind = type === 'calories' ? 'activeCalories' : 'distance';
      return this.attempt(
        base,
        writable,
        () => this.platform.deleteAmount(kind, base.clientRecordId),
        { status: 'removed', version, value: null },
      );
    }
    if (
      previous?.status === 'exported' &&
      previous.exportedValue === value &&
      (previous.exportedVersion ?? -1) >= sourceVersion
    ) {
      return 'unchanged';
    }
    const span = {
      clientRecordId: base.clientRecordId,
      clientRecordVersion: version,
      start: plan.session.start,
      end: plan.session.end,
    };
    return this.attempt(
      base,
      writable,
      () =>
        type === 'calories'
          ? this.platform.writeActiveCalories({ ...span, kcal: value })
          : this.platform.writeDistance({ ...span, meters: value }),
      { status: 'exported', version, value },
    );
  }

  /** Writes or deletes one record and notes the outcome before and after. */
  private async attempt(
    base: HealthExportRecord,
    writable: HealthWriteAccess | null,
    send: () => Promise<void>,
    done: { status: 'exported' | 'removed'; version: number; value: number | null },
  ): Promise<RecordResult> {
    if (!writable?.[PERMISSION[base.recordType]]) {
      // Nothing sent: Health Connect is gone, or this type has no permission (yet). A session
      // counts as failed; an amount simply waits until its permission is granted.
      const session = base.recordType === 'session';
      await this.repository.save(
        {
          ...base,
          status: session || !writable ? 'failed' : 'pending',
          lastError: writable ? 'permission' : 'unavailable',
        },
        this.now(),
      );
      return session || !writable ? 'failed' : 'waiting';
    }
    const attemptAt = this.now();
    // Noted before the write: if the app stops in between, the record is retried later.
    const pending: HealthExportRecord = {
      ...base,
      status: base.status === 'failed' ? 'failed' : 'pending',
      attempts: base.attempts + 1,
      lastAttemptAt: attemptAt,
    };
    await this.repository.save(pending, attemptAt);
    try {
      await send();
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
        status: done.status,
        exportedVersion: done.version,
        exportedValue: done.value,
        lastError: null,
        lastSuccessAt: at,
      },
      at,
    );
    return 'exported';
  }
}
