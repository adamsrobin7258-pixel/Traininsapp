import type { SqlExecutor } from '@/core/database';
import type { HealthExportErrorCode } from '@/core/platform/health';
import { createId } from '@/shared/lib/id';
import type { ExportRecordType, ExportSkipReason, ExportSourceKind } from './healthExport';

/** The export switch on this device (app_settings: device-bound, never synced to a cloud). */
export interface HealthExportSetting {
  enabled: boolean;
  /** When it was last turned on. */
  enabledAt: string | null;
  /**
   * When the one-time pass over the whole history finished; `null` while it is still to do
   * (after turning on, and once after the update that added calories and distance). The pass
   * resumes on the next app start until it is done.
   */
  historyDoneAt: string | null;
}

export const EXPORT_OFF: HealthExportSetting = {
  enabled: false,
  enabledAt: null,
  historyDoneAt: null,
};

export type ExportStatus = 'pending' | 'exported' | 'failed' | 'skipped' | 'removed';
export type ExportError = HealthExportErrorCode | Exclude<ExportSkipReason, 'invalid'>;

/** One Health Connect record of an own record and what the export did with it. */
export interface HealthExportRecord {
  profileId: string;
  sourceKind: ExportSourceKind;
  sourceId: string;
  recordType: ExportRecordType;
  clientRecordId: string;
  status: ExportStatus;
  /** Client record version of the last successful write or delete (epoch ms based). */
  exportedVersion: number | null;
  /** Amount last written (kcal or metres); `null` for sessions and after a removal. */
  exportedValue: number | null;
  attempts: number;
  lastError: ExportError | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
}

const KEY = 'healthConnectExport';

interface Row {
  profile_id: string;
  source_kind: ExportSourceKind;
  source_id: string;
  record_type: ExportRecordType;
  client_record_id: string;
  status: ExportStatus;
  exported_version: number | null;
  exported_value: number | null;
  attempts: number;
  last_error: ExportError | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
}

const toRecord = (row: Row): HealthExportRecord => ({
  profileId: row.profile_id,
  sourceKind: row.source_kind,
  sourceId: row.source_id,
  recordType: row.record_type,
  clientRecordId: row.client_record_id,
  status: row.status,
  exportedVersion: row.exported_version,
  exportedValue: row.exported_value,
  attempts: row.attempts,
  lastError: row.last_error,
  lastAttemptAt: row.last_attempt_at,
  lastSuccessAt: row.last_success_at,
});

/** Validates a stored setting; anything unexpected means "off". */
export function parseExportSetting(value: unknown): HealthExportSetting {
  if (typeof value !== 'object' || value === null) return EXPORT_OFF;
  const raw = value as Record<string, unknown>;
  const time = (value: unknown) =>
    typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
  return {
    enabled: raw.enabled === true,
    enabledAt: time(raw.enabledAt),
    historyDoneAt: time(raw.historyDoneAt),
  };
}

/** SQL of the Health Connect export: its setting and its bookkeeping, scoped to one profile. */
export class HealthExportRepository {
  constructor(private readonly db: SqlExecutor) {}

  async loadSetting(): Promise<HealthExportSetting> {
    const rows = await this.db.query<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [KEY],
    );
    if (!rows[0]) return EXPORT_OFF;
    try {
      return parseExportSetting(JSON.parse(rows[0].value));
    } catch {
      return EXPORT_OFF;
    }
  }

  async saveSetting(setting: HealthExportSetting, now: string): Promise<void> {
    await this.db.run(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [KEY, JSON.stringify(setting), now],
    );
  }

  /** The rows of one own record, at most one per record type. */
  async findAll(
    profileId: string,
    sourceKind: ExportSourceKind,
    sourceId: string,
  ): Promise<HealthExportRecord[]> {
    const rows = await this.db.query<Row>(
      `SELECT * FROM health_connect_exports
       WHERE profile_id = ? AND source_kind = ? AND source_id = ?`,
      [profileId, sourceKind, sourceId],
    );
    return rows.map(toRecord);
  }

  /** Inserts or updates one row (unique per profile, own record and record type). */
  async save(record: HealthExportRecord, now: string): Promise<void> {
    await this.db.run(
      `INSERT INTO health_connect_exports (id, profile_id, source_kind, source_id, record_type,
         client_record_id, status, exported_version, exported_value, attempts, last_error,
         last_attempt_at, last_success_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(profile_id, source_kind, source_id, record_type) DO UPDATE SET
         client_record_id = excluded.client_record_id,
         status = excluded.status,
         exported_version = excluded.exported_version,
         exported_value = excluded.exported_value,
         attempts = excluded.attempts,
         last_error = excluded.last_error,
         last_attempt_at = excluded.last_attempt_at,
         last_success_at = excluded.last_success_at,
         updated_at = excluded.updated_at`,
      [
        createId(),
        record.profileId,
        record.sourceKind,
        record.sourceId,
        record.recordType,
        record.clientRecordId,
        record.status,
        record.exportedVersion,
        record.exportedValue,
        record.attempts,
        record.lastError,
        record.lastAttemptAt,
        record.lastSuccessAt,
        now,
        now,
      ],
    );
  }

  /**
   * Own records with a row still to do (pending or failed) of one of `types` – each record once,
   * oldest attempt first. Types without a permission are left out, so they never crowd out the
   * others.
   */
  async retryable(
    profileId: string,
    types: readonly ExportRecordType[],
    limit: number,
  ): Promise<{ sourceKind: ExportSourceKind; sourceId: string }[]> {
    if (types.length === 0) return [];
    const rows = await this.db.query<{ source_kind: ExportSourceKind; source_id: string }>(
      `SELECT source_kind, source_id FROM health_connect_exports
       WHERE profile_id = ? AND status IN ('pending', 'failed')
         AND record_type IN (${types.map(() => '?').join(', ')})
       GROUP BY source_kind, source_id
       ORDER BY MIN(COALESCE(last_attempt_at, created_at)) LIMIT ?`,
      [profileId, ...types, limit],
    );
    return rows.map((row) => ({ sourceKind: row.source_kind, sourceId: row.source_id }));
  }

  /** Forgets one row – an amount that was never sent, so nothing of it is in Health Connect. */
  async removeType(
    profileId: string,
    sourceKind: ExportSourceKind,
    sourceId: string,
    recordType: ExportRecordType,
  ): Promise<void> {
    await this.db.run(
      `DELETE FROM health_connect_exports
       WHERE profile_id = ? AND source_kind = ? AND source_id = ? AND record_type = ?`,
      [profileId, sourceKind, sourceId, recordType],
    );
  }

  /** Rows per status, optionally only of some record types. */
  async countByStatus(
    profileId: string,
    types: readonly ExportRecordType[] = ['session', 'calories', 'distance'],
  ): Promise<Record<ExportStatus, number>> {
    if (types.length === 0) return { pending: 0, exported: 0, failed: 0, skipped: 0, removed: 0 };
    const rows = await this.db.query<{ status: ExportStatus; n: number }>(
      `SELECT status, COUNT(*) AS n FROM health_connect_exports
       WHERE profile_id = ? AND record_type IN (${types.map(() => '?').join(', ')})
       GROUP BY status`,
      [profileId, ...types],
    );
    const counts: Record<ExportStatus, number> = {
      pending: 0,
      exported: 0,
      failed: 0,
      skipped: 0,
      removed: 0,
    };
    for (const row of rows) counts[row.status] = row.n;
    return counts;
  }

  async lastSuccessAt(profileId: string): Promise<string | null> {
    const rows = await this.db.query<{ at: string | null }>(
      'SELECT MAX(last_success_at) AS at FROM health_connect_exports WHERE profile_id = ?',
      [profileId],
    );
    return rows[0]?.at ?? null;
  }

  /** Forgets the rows of a record that no longer exists in Kalethra (Health Connect keeps its copies). */
  async remove(profileId: string, sourceKind: ExportSourceKind, sourceId: string): Promise<void> {
    await this.db.run(
      `DELETE FROM health_connect_exports
       WHERE profile_id = ? AND source_kind = ? AND source_id = ?`,
      [profileId, sourceKind, sourceId],
    );
  }
}
