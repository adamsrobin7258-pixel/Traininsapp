import type { SqlExecutor } from '@/core/database';
import { PROFILE_SEXES, type BodyData, type Profile, type ProfileSex } from './types';

interface ProfileRow {
  id: string;
  display_name: string | null;
  sex: string | null;
  birth_date: string | null;
  height_cm: number | null;
  created_at: string;
  updated_at: string;
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    sex: (PROFILE_SEXES as readonly string[]).includes(row.sex ?? '')
      ? (row.sex as ProfileSex)
      : null,
    birthDate: row.birth_date,
    heightCm: row.height_cm,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProfileRepository {
  constructor(private readonly db: SqlExecutor) {}

  async findFirstActive(): Promise<Profile | null> {
    const rows = await this.db.query<ProfileRow>(
      `SELECT id, display_name, sex, birth_date, height_cm, created_at, updated_at FROM profiles
       WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`,
    );
    return rows[0] ? toProfile(rows[0]) : null;
  }

  async findById(id: string): Promise<Profile | null> {
    const rows = await this.db.query<ProfileRow>(
      `SELECT id, display_name, sex, birth_date, height_cm, created_at, updated_at FROM profiles
       WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ? toProfile(rows[0]) : null;
  }

  async updateBodyData(id: string, data: BodyData, updatedAt: string) {
    const result = await this.db.run(
      `UPDATE profiles
       SET sex = ?, birth_date = ?, height_cm = ?, updated_at = ?,
           sync_state = CASE WHEN sync_state = 'synced' THEN 'pending' ELSE sync_state END
       WHERE id = ? AND deleted_at IS NULL`,
      [data.sex, data.birthDate, data.heightCm, updatedAt, id],
    );
    if (result.changes !== 1) throw new Error(`Profile ${id} not found`);
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
