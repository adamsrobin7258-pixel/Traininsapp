import type { SqlExecutor } from '@/core/database';
import { HEALTH_DATA_KINDS, type HealthDataKind } from '@/core/platform/health';

/** Result of the last sync attempt. */
export type HealthSyncResult =
  /** Every permitted kind was read and stored. */
  | 'ok'
  /** Read and stored, but at least one kind lacks permission. */
  | 'partial'
  /** Reading or storing failed; nothing was deleted. */
  | 'failed'
  /** No permission for any imported kind. */
  | 'permission'
  /** Health Connect not available (anymore). */
  | 'unavailable';

/** Connection state on this device (app_settings: device-bound, never synced to a cloud). */
export interface HealthConnectionState {
  enabled: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastResult: HealthSyncResult | null;
  /** Imported kinds without access at the last check. */
  missing: HealthDataKind[];
}

export const DISCONNECTED: HealthConnectionState = {
  enabled: false,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastResult: null,
  missing: [],
};

const KEY = 'healthConnect';
const RESULTS: readonly HealthSyncResult[] = [
  'ok',
  'partial',
  'failed',
  'permission',
  'unavailable',
];

const isoOrNull = (value: unknown): string | null =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;

/** Validates a stored value; anything unexpected falls back to "not connected". */
export function parseConnectionState(value: unknown): HealthConnectionState {
  if (typeof value !== 'object' || value === null) return DISCONNECTED;
  const raw = value as Record<string, unknown>;
  return {
    enabled: raw.enabled === true,
    lastAttemptAt: isoOrNull(raw.lastAttemptAt),
    lastSuccessAt: isoOrNull(raw.lastSuccessAt),
    lastResult: RESULTS.find((result) => result === raw.lastResult) ?? null,
    missing: Array.isArray(raw.missing)
      ? HEALTH_DATA_KINDS.filter((kind) => (raw.missing as unknown[]).includes(kind))
      : [],
  };
}

/** Reads and writes the connection state as one JSON value in `app_settings`. */
export class HealthConnectionRepository {
  constructor(private readonly db: SqlExecutor) {}

  async load(): Promise<HealthConnectionState> {
    const rows = await this.db.query<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [KEY],
    );
    if (!rows[0]) return DISCONNECTED;
    try {
      return parseConnectionState(JSON.parse(rows[0].value));
    } catch {
      return DISCONNECTED;
    }
  }

  async save(state: HealthConnectionState, now: string): Promise<void> {
    await this.db.run(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [KEY, JSON.stringify(state), now],
    );
  }
}
