import type { SqlExecutor } from '@/core/database';
import { isRecoveryState, type RecoveryEntry } from './recovery';

interface Row {
  id: string;
  profile_id: string;
  local_date: string;
  state: string | null;
  rest_day: number;
  created_at: string;
  updated_at: string;
}

const toEntry = (row: Row): RecoveryEntry => ({
  id: row.id,
  profileId: row.profile_id,
  localDate: row.local_date,
  state: isRecoveryState(row.state) ? row.state : null,
  restDay: row.rest_day === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** SQL for `recovery_entries`, always scoped to one profile. */
export class RecoveryRepository {
  constructor(private readonly db: SqlExecutor) {}

  async listBetween(profileId: string, from: string, to: string): Promise<RecoveryEntry[]> {
    const rows = await this.db.query<Row>(
      `SELECT * FROM recovery_entries WHERE profile_id = ? AND local_date BETWEEN ? AND ?
       ORDER BY local_date`,
      [profileId, from, to],
    );
    return rows.map(toEntry);
  }

  async find(profileId: string, localDate: string): Promise<RecoveryEntry | null> {
    const rows = await this.db.query<Row>(
      'SELECT * FROM recovery_entries WHERE profile_id = ? AND local_date = ?',
      [profileId, localDate],
    );
    return rows[0] ? toEntry(rows[0]) : null;
  }

  async upsert(entry: RecoveryEntry): Promise<void> {
    await this.db.run(
      `INSERT INTO recovery_entries (id, profile_id, local_date, state, rest_day, created_at,
         updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (profile_id, local_date) DO UPDATE SET state = excluded.state,
         rest_day = excluded.rest_day, updated_at = excluded.updated_at`,
      [
        entry.id,
        entry.profileId,
        entry.localDate,
        entry.state,
        entry.restDay ? 1 : 0,
        entry.createdAt,
        entry.updatedAt,
      ],
    );
  }

  async delete(profileId: string, localDate: string): Promise<void> {
    await this.db.run('DELETE FROM recovery_entries WHERE profile_id = ? AND local_date = ?', [
      profileId,
      localDate,
    ]);
  }
}
