import type { SqlExecutor } from '@/core/database';
import type { WeightEntry } from './weight';

interface WeightRow {
  id: string;
  profile_id: string;
  date: string;
  value: number;
  created_at: string;
  updated_at: string;
}

const COLUMNS = 'id, profile_id, date, value, created_at, updated_at';

function toEntry(row: WeightRow): WeightEntry {
  return {
    id: row.id,
    profileId: row.profile_id,
    date: row.date,
    kg: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** SQL for `weight_entries`. All queries are scoped to one profile and use the (profile_id, date) index. */
export class WeightRepository {
  constructor(private readonly db: SqlExecutor) {}

  async findByDate(profileId: string, date: string): Promise<WeightEntry | null> {
    const rows = await this.db.query<WeightRow>(
      `SELECT ${COLUMNS} FROM weight_entries WHERE profile_id = ? AND date = ?`,
      [profileId, date],
    );
    return rows[0] ? toEntry(rows[0]) : null;
  }

  async findById(profileId: string, id: string): Promise<WeightEntry | null> {
    const rows = await this.db.query<WeightRow>(
      `SELECT ${COLUMNS} FROM weight_entries WHERE profile_id = ? AND id = ?`,
      [profileId, id],
    );
    return rows[0] ? toEntry(rows[0]) : null;
  }

  /** Most recent entry on or before `date`. */
  async findLatest(profileId: string, onOrBefore: string): Promise<WeightEntry | null> {
    const rows = await this.db.query<WeightRow>(
      `SELECT ${COLUMNS} FROM weight_entries WHERE profile_id = ? AND date <= ?
       ORDER BY date DESC LIMIT 1`,
      [profileId, onOrBefore],
    );
    return rows[0] ? toEntry(rows[0]) : null;
  }

  /** Newest first, paginated. */
  async listRecent(profileId: string, limit: number, offset = 0): Promise<WeightEntry[]> {
    const rows = await this.db.query<WeightRow>(
      `SELECT ${COLUMNS} FROM weight_entries WHERE profile_id = ?
       ORDER BY date DESC LIMIT ? OFFSET ?`,
      [profileId, limit, offset],
    );
    return rows.map(toEntry);
  }

  /** Oldest first, inclusive range; `from` may be null for "all". */
  async listRange(profileId: string, from: string | null, to: string): Promise<WeightEntry[]> {
    const rows = await this.db.query<WeightRow>(
      `SELECT ${COLUMNS} FROM weight_entries
       WHERE profile_id = ? AND date <= ? AND (? IS NULL OR date >= ?)
       ORDER BY date ASC`,
      [profileId, to, from, from],
    );
    return rows.map(toEntry);
  }

  async count(profileId: string): Promise<number> {
    const rows = await this.db.query<{ n: number }>(
      'SELECT COUNT(*) AS n FROM weight_entries WHERE profile_id = ?',
      [profileId],
    );
    return rows[0]?.n ?? 0;
  }

  /** Inserts or replaces the value for the entry's day (one entry per profile and day). */
  async upsertForDate(entry: WeightEntry): Promise<void> {
    await this.db.run(
      `INSERT INTO weight_entries (id, profile_id, date, value, unit, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'kg', ?, ?)
       ON CONFLICT(profile_id, date) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at,
         sync_state = CASE WHEN sync_state = 'synced' THEN 'pending' ELSE sync_state END`,
      [entry.id, entry.profileId, entry.date, entry.kg, entry.createdAt, entry.updatedAt],
    );
  }

  async updateValue(profileId: string, id: string, kg: number, updatedAt: string) {
    const result = await this.db.run(
      `UPDATE weight_entries
       SET value = ?, updated_at = ?,
           sync_state = CASE WHEN sync_state = 'synced' THEN 'pending' ELSE sync_state END
       WHERE profile_id = ? AND id = ?`,
      [kg, updatedAt, profileId, id],
    );
    return result.changes === 1;
  }

  /** Physical delete: there is no cloud copy that would need a tombstone yet. */
  async delete(profileId: string, id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM weight_entries WHERE profile_id = ? AND id = ?', [
      profileId,
      id,
    ]);
    return result.changes === 1;
  }
}
