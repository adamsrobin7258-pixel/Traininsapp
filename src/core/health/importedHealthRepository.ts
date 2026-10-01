import type { SqlExecutor } from '@/core/database';
import type { HealthPlatformId } from '@/core/platform/health';
import { createId } from '@/shared/lib/id';
import type {
  ActivityDay,
  DailyActivity,
  ImportedWeight,
  ImportedWeightDay,
  SyncWindow,
} from './importedHealth';

interface WeightRow {
  profile_id: string;
  platform: HealthPlatformId;
  date: string;
  value: number;
  measured_at: string;
  external_id: string | null;
  source: string | null;
}

interface ActivityRow {
  profile_id: string;
  platform: HealthPlatformId;
  date: string;
  steps: number | null;
  active_kcal: number | null;
}

const WEIGHT_COLUMNS = 'profile_id, platform, date, value, measured_at, external_id, source';
const ACTIVITY_COLUMNS = 'profile_id, platform, date, steps, active_kcal';

function toWeight(row: WeightRow): ImportedWeight {
  return {
    profileId: row.profile_id,
    platform: row.platform,
    date: row.date,
    kg: row.value,
    measuredAt: row.measured_at,
    externalId: row.external_id,
    source: row.source,
  };
}

function toActivity(row: ActivityRow): DailyActivity {
  return {
    profileId: row.profile_id,
    platform: row.platform,
    date: row.date,
    steps: row.steps,
    activeKcal: row.active_kcal,
  };
}

/** Activity column per imported kind. */
const ACTIVITY_COLUMN = { steps: 'steps', activeEnergy: 'active_kcal' } as const;

/**
 * SQL for imported health data (`imported_weights`, `daily_activity`). Never touches Kalethra's
 * own tables. Writes are meant to run inside one transaction per sync (see HealthSyncService).
 */
export class ImportedHealthRepository {
  constructor(private readonly db: SqlExecutor) {}

  /** Inserts or updates one imported value per day; other days stay untouched. */
  async upsertWeights(
    profileId: string,
    platform: HealthPlatformId,
    days: readonly ImportedWeightDay[],
    now: string,
  ): Promise<void> {
    for (const day of days) {
      await this.db.run(
        `INSERT INTO imported_weights (id, profile_id, platform, date, value, unit, measured_at,
           external_id, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'kg', ?, ?, ?, ?, ?)
         ON CONFLICT(profile_id, platform, date) DO UPDATE SET value = excluded.value,
           measured_at = excluded.measured_at, external_id = excluded.external_id,
           source = excluded.source, updated_at = excluded.updated_at
         WHERE value IS NOT excluded.value OR measured_at IS NOT excluded.measured_at
           OR external_id IS NOT excluded.external_id OR source IS NOT excluded.source`,
        [
          createId(),
          profileId,
          platform,
          day.date,
          day.kg,
          day.measuredAt,
          day.externalId,
          day.source,
          now,
          now,
        ],
      );
    }
  }

  /**
   * Removes imported weights of window days the platform no longer returns (deleted or changed
   * there). Call only after a complete, successful read. Days outside the window stay.
   */
  async removeWeightsMissingFrom(
    profileId: string,
    platform: HealthPlatformId,
    window: SyncWindow,
    keep: readonly ImportedWeightDay[],
  ): Promise<number> {
    const dates = keep.map((day) => day.date);
    const result = await this.db.run(
      `DELETE FROM imported_weights
       WHERE profile_id = ? AND platform = ? AND date >= ? AND date <= ?
         AND date NOT IN (${dates.map(() => '?').join(', ') || "''"})`,
      [profileId, platform, window.fromDate, window.toDate, ...dates],
    );
    return result.changes;
  }

  /** Sets one activity value per day (steps or active energy); the other column is kept. */
  async upsertActivity(
    profileId: string,
    platform: HealthPlatformId,
    kind: keyof typeof ACTIVITY_COLUMN,
    days: readonly ActivityDay[],
    now: string,
  ): Promise<void> {
    const column = ACTIVITY_COLUMN[kind];
    for (const day of days) {
      await this.db.run(
        `INSERT INTO daily_activity (profile_id, platform, date, ${column}, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(profile_id, platform, date) DO UPDATE SET ${column} = excluded.${column},
           updated_at = excluded.updated_at
         WHERE ${column} IS NOT excluded.${column}`,
        [profileId, platform, day.date, day.value, now, now],
      );
    }
  }

  /**
   * Clears one activity value on window days the platform no longer reports and removes rows
   * left without any value. Call only after a complete, successful read of that kind.
   */
  async clearActivityMissingFrom(
    profileId: string,
    platform: HealthPlatformId,
    kind: keyof typeof ACTIVITY_COLUMN,
    window: SyncWindow,
    keep: readonly ActivityDay[],
    now: string,
  ): Promise<void> {
    const column = ACTIVITY_COLUMN[kind];
    const dates = keep.map((day) => day.date);
    await this.db.run(
      `UPDATE daily_activity SET ${column} = NULL, updated_at = ?
       WHERE profile_id = ? AND platform = ? AND date >= ? AND date <= ? AND ${column} IS NOT NULL
         AND date NOT IN (${dates.map(() => '?').join(', ') || "''"})`,
      [now, profileId, platform, window.fromDate, window.toDate, ...dates],
    );
    await this.db.run(
      `DELETE FROM daily_activity
       WHERE profile_id = ? AND platform = ? AND steps IS NULL AND active_kcal IS NULL`,
      [profileId, platform],
    );
  }

  /** Deletes every imported value of the platform – and nothing else. */
  async deleteAll(profileId: string, platform: HealthPlatformId): Promise<void> {
    await this.db.run('DELETE FROM imported_weights WHERE profile_id = ? AND platform = ?', [
      profileId,
      platform,
    ]);
    await this.db.run('DELETE FROM daily_activity WHERE profile_id = ? AND platform = ?', [
      profileId,
      platform,
    ]);
  }

  async listWeights(profileId: string, from: string, to: string): Promise<ImportedWeight[]> {
    const rows = await this.db.query<WeightRow>(
      `SELECT ${WEIGHT_COLUMNS} FROM imported_weights
       WHERE profile_id = ? AND date >= ? AND date <= ? ORDER BY date, platform`,
      [profileId, from, to],
    );
    return rows.map(toWeight);
  }

  /** Most recent imported weight on or before a day. */
  async latestWeight(profileId: string, onOrBefore: string): Promise<ImportedWeight | null> {
    const rows = await this.db.query<WeightRow>(
      `SELECT ${WEIGHT_COLUMNS} FROM imported_weights
       WHERE profile_id = ? AND date <= ? ORDER BY date DESC, platform LIMIT 1`,
      [profileId, onOrBefore],
    );
    return rows[0] ? toWeight(rows[0]) : null;
  }

  async listActivity(profileId: string, from: string, to: string): Promise<DailyActivity[]> {
    const rows = await this.db.query<ActivityRow>(
      `SELECT ${ACTIVITY_COLUMNS} FROM daily_activity
       WHERE profile_id = ? AND date >= ? AND date <= ? ORDER BY date, platform`,
      [profileId, from, to],
    );
    return rows.map(toActivity);
  }

  async hasData(profileId: string): Promise<boolean> {
    const rows = await this.db.query<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM imported_weights WHERE profile_id = ?)
            + (SELECT COUNT(*) FROM daily_activity WHERE profile_id = ?) AS n`,
      [profileId, profileId],
    );
    return (rows[0]?.n ?? 0) > 0;
  }
}
