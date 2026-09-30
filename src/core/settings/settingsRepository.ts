import type { SqlExecutor } from '@/core/database';
import type { Clock } from '@/shared/lib/clock';

/** Key/value storage for app-wide settings. Values are stored as JSON. */
export class SettingsRepository {
  constructor(
    private readonly db: SqlExecutor,
    private readonly clock: Clock,
  ) {}

  async getAll(): Promise<Map<string, unknown>> {
    const rows = await this.db.query<{ key: string; value: string }>(
      'SELECT key, value FROM app_settings',
    );
    const entries = new Map<string, unknown>();
    for (const row of rows) {
      try {
        entries.set(row.key, JSON.parse(row.value));
      } catch {
        // Ignore corrupt values; the service falls back to defaults.
      }
    }
    return entries;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.db.run(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, JSON.stringify(value), this.clock().toISOString()],
    );
  }
}
