import type { SqlExecutor } from '@/core/database';
import type { Profile } from './types';

interface ProfileRow {
  id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProfileRepository {
  constructor(private readonly db: SqlExecutor) {}

  async findFirstActive(): Promise<Profile | null> {
    const rows = await this.db.query<ProfileRow>(
      `SELECT id, display_name, created_at, updated_at FROM profiles
       WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`,
    );
    return rows[0] ? toProfile(rows[0]) : null;
  }

  async insert(profile: Profile): Promise<void> {
    await this.db.run(
      `INSERT INTO profiles (id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      [profile.id, profile.displayName, profile.createdAt, profile.updatedAt],
    );
  }

  async updateDisplayName(id: string, displayName: string | null, updatedAt: string) {
    const result = await this.db.run(
      `UPDATE profiles
       SET display_name = ?, updated_at = ?,
           sync_state = CASE WHEN sync_state = 'synced' THEN 'pending' ELSE sync_state END
       WHERE id = ? AND deleted_at IS NULL`,
      [displayName, updatedAt, id],
    );
    if (result.changes !== 1) throw new Error(`Profile ${id} not found`);
  }
}
