import type { SqlExecutor } from '@/core/database';
import { isTargetKind, type TargetKind, type TargetVersion } from './targets';

interface Row {
  id: string;
  profile_id: string;
  kind: string;
  effective_from: string;
  value: number | null;
  created_at: string;
  updated_at: string;
}

const toVersion = (row: Row): TargetVersion | null =>
  isTargetKind(row.kind)
    ? {
        id: row.id,
        profileId: row.profile_id,
        kind: row.kind,
        effectiveFrom: row.effective_from,
        value: row.value,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;

/** SQL for `goal_targets`, always scoped to one profile. */
export class TargetRepository {
  constructor(private readonly db: SqlExecutor) {}

  async list(profileId: string): Promise<TargetVersion[]> {
    const rows = await this.db.query<Row>(
      'SELECT * FROM goal_targets WHERE profile_id = ? ORDER BY kind, effective_from',
      [profileId],
    );
    return rows.flatMap((row) => {
      const version = toVersion(row);
      return version ? [version] : [];
    });
  }

  async find(
    profileId: string,
    kind: TargetKind,
    effectiveFrom: string,
  ): Promise<TargetVersion | null> {
    const rows = await this.db.query<Row>(
      'SELECT * FROM goal_targets WHERE profile_id = ? AND kind = ? AND effective_from = ?',
      [profileId, kind, effectiveFrom],
    );
    return rows[0] ? toVersion(rows[0]) : null;
  }

  /** One version per profile, kind and day: a second change on the same day replaces it. */
  async upsert(version: TargetVersion): Promise<void> {
    await this.db.run(
      `INSERT INTO goal_targets (id, profile_id, kind, effective_from, value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (profile_id, kind, effective_from) DO UPDATE SET value = excluded.value,
         updated_at = excluded.updated_at`,
      [
        version.id,
        version.profileId,
        version.kind,
        version.effectiveFrom,
        version.value,
        version.createdAt,
        version.updatedAt,
      ],
    );
  }
}
