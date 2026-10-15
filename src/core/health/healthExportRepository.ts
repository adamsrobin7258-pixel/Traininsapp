import type { SqlExecutor } from '@/core/database';
import type { HealthExportErrorCode } from '@/core/platform/health';
import { createId } from '@/shared/lib/id';
import type { ExportSkipReason, ExportSourceKind } from './healthExport';

/** The export switch on this device (app_settings: device-bound, never synced to a cloud). */
export interface HealthExportSetting {
  enabled: boolean;
  /** When it was last turned on – the start of "only new from now on" plus the 30-day catch-up. */
  enabledAt: string | null;
}

export const EXPORT_OFF: HealthExportSetting = { enabled: false, enabledAt: null };

export type ExportStatus = 'pending' | 'exported' | 'failed' | 'skipped';
export type ExportError = HealthExportErrorCode | Exclude<ExportSkipReason, 'invalid'>;

/** One own record and what the export did with it (`health_connect_exports`). */
export interface HealthExportRecord {
  profileId: string;
  sourceKind: ExportSourceKind;
  sourceId: string;
  clientRecordId: string;
  status: ExportStatus;
  /** Version (epoch ms of the record's last change) of the last successful write. */
  exportedVersion: number | null;
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
  client_record_id: string;
  status: ExportStatus;
  exported_version: number | null;
  attempts: number;
  last_error: ExportError | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
}

const toRecord = (row: Row): HealthExportRecord => ({
  profileId: row.profile_id,
  sourceKind: row.source_kind,
  sourceId: row.source_id,
  clientRecordId: row.client_record_id,
  status: row.status,
  exportedVersion: row.exported_version,
  attempts: row.attempts,
  lastError: row.last_error,
  lastAttemptAt: row.last_attempt_at,
  lastSuccessAt: row.last_success_at,
});

/** Validates a stored setting; anything unexpected means "off". */
export function parseExportSetting(value: unknown): HealthExportSetting {
  if (typeof value !== 'object' || value === null) return EXPORT_OFF;
  const raw = value as Record<string, unknown>;
  const enabledAt =
    typeof raw.enabledAt === 'string' && !Number.isNaN(Date.parse(raw.enabledAt))
      ? raw.enabledAt
      : null;
  return { enabled: raw.enabled === true, enabledAt };
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

  async find(
    profileId: string,
    sourceKind: ExportSourceKind,
    sourceId: string,
  ): Promise<HealthExportRecord | null> {
    const rows = await this.db.query<Row>(
      `SELECT * FROM health_connect_exports
       WHERE profile_id = ? AND source_kind = ? AND source_id = ?`,
      [profileId, sourceKind, sourceId],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  /** Inserts or updates the row of one own record (unique per profile and record). */
  async save(record: HealthExportRecord, now: string): Promise<void> {
    await this.db.run(
      `INSERT INTO health_connect_exports (id, profile_id, source_kind, source_id,
         client_record_id, status, exported_version, attempts, last_error, last_attempt_at,
         last_success_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(profile_id, source_kind, source_id) DO UPDATE SET
         client_record_id = excluded.client_record_id,
         status = excluded.status,
         exported_version = excluded.exported_version,
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
        record.clientRecordId,
        record.status,
        record.exportedVersion,
        record.attempts,
        record.lastError,
        record.lastAttemptAt,
        record.lastSuccessAt,
        now,
        now,
      ],
    );
  }

  /** Records still to write (pending or failed), oldest attempt first. */
  async retryable(profileId: string, limit: number): Promise<HealthExportRecord[]> {
    const rows = await this.db.query<Row>(
      `SELECT * FROM health_connect_exports
       WHERE profile_id = ? AND status IN ('pending', 'failed')
       ORDER BY COALESCE(last_attempt_at, created_at) LIMIT ?`,
      [profileId, limit],
    );
    return rows.map(toRecord);
  }

  async countByStatus(profileId: string): Promise<Record<ExportStatus, number>> {
    const rows = await this.db.query<{ status: ExportStatus; n: number }>(
      `SELECT status, COUNT(*) AS n FROM health_connect_exports
       WHERE profile_id = ? GROUP BY status`,
      [profileId],
    );
    const counts: Record<ExportStatus, number> = {
      pending: 0,
      exported: 0,
      failed: 0,
      skipped: 0,
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

  /** Forgets the row of a record that no longer exists in Kalethra (Health Connect keeps its copy). */
  async remove(profileId: string, sourceKind: ExportSourceKind, sourceId: string): Promise<void> {
    await this.db.run(
      `DELETE FROM health_connect_exports
       WHERE profile_id = ? AND source_kind = ? AND source_id = ?`,
      [profileId, sourceKind, sourceId],
    );
  }
}
