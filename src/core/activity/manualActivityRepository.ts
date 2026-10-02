import type { SqlExecutor } from '@/core/database';
import { INTENSITIES, VARIANT_OPTIONS, type Intensity, type VariantOption } from './catalog';
import type { ManualActivity } from './manualActivity';

interface Row {
  id: string;
  profile_id: string;
  sport_id: string;
  local_date: string;
  started_at: string | null;
  duration_s: number;
  distance_m: number | null;
  intensity: string | null;
  variant: string | null;
  weight_kg: number | null;
  met: number;
  met_ref: string;
  met_basis: string;
  calc_method: string;
  calculated_kcal: number | null;
  kcal: number | null;
  kcal_overridden: number;
  created_at: string;
  updated_at: string;
}

const VARIANTS = new Set<string>(Object.values(VARIANT_OPTIONS).flat());

const toActivity = (row: Row): ManualActivity => ({
  id: row.id,
  profileId: row.profile_id,
  sportId: row.sport_id,
  localDate: row.local_date,
  startedAt: row.started_at,
  durationS: row.duration_s,
  distanceM: row.distance_m,
  intensity: (INTENSITIES as readonly string[]).includes(row.intensity ?? '')
    ? (row.intensity as Intensity)
    : null,
  variant: VARIANTS.has(row.variant ?? '') ? (row.variant as VariantOption) : null,
  weightKg: row.weight_kg,
  met: row.met,
  metRef: row.met_ref,
  metBasis: row.met_basis === 'general' ? 'general' : 'specific',
  calcMethod: row.calc_method,
  calculatedKcal: row.calculated_kcal,
  kcal: row.kcal,
  kcalOverridden: row.kcal_overridden === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** SQL for `manual_activities`, always scoped to one profile. */
export class ManualActivityRepository {
  constructor(private readonly db: SqlExecutor) {}

  async listBetween(profileId: string, from: string, to: string): Promise<ManualActivity[]> {
    const rows = await this.db.query<Row>(
      `SELECT * FROM manual_activities WHERE profile_id = ? AND local_date BETWEEN ? AND ?
       ORDER BY local_date DESC, COALESCE(started_at, '') DESC, created_at DESC`,
      [profileId, from, to],
    );
    return rows.map(toActivity);
  }

  async recent(profileId: string, limit: number): Promise<ManualActivity[]> {
    const rows = await this.db.query<Row>(
      `SELECT * FROM manual_activities WHERE profile_id = ?
       ORDER BY local_date DESC, COALESCE(started_at, '') DESC, created_at DESC LIMIT ?`,
      [profileId, limit],
    );
    return rows.map(toActivity);
  }

  async find(profileId: string, id: string): Promise<ManualActivity | null> {
    const rows = await this.db.query<Row>(
      'SELECT * FROM manual_activities WHERE profile_id = ? AND id = ?',
      [profileId, id],
    );
    return rows[0] ? toActivity(rows[0]) : null;
  }

  async insert(activity: ManualActivity): Promise<void> {
    await this.db.run(
      `INSERT INTO manual_activities (id, profile_id, sport_id, local_date, started_at, duration_s,
         distance_m, intensity, variant, weight_kg, met, met_ref, met_basis, calc_method,
         calculated_kcal, kcal, kcal_overridden, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        activity.id,
        activity.profileId,
        ...this.values(activity),
        activity.createdAt,
        activity.updatedAt,
      ],
    );
  }

  async update(activity: ManualActivity): Promise<void> {
    await this.db.run(
      `UPDATE manual_activities SET sport_id = ?, local_date = ?, started_at = ?, duration_s = ?,
         distance_m = ?, intensity = ?, variant = ?, weight_kg = ?, met = ?, met_ref = ?,
         met_basis = ?, calc_method = ?, calculated_kcal = ?, kcal = ?, kcal_overridden = ?,
         updated_at = ?
       WHERE profile_id = ? AND id = ?`,
      [...this.values(activity), activity.updatedAt, activity.profileId, activity.id],
    );
  }

  async delete(profileId: string, id: string): Promise<boolean> {
    const before = await this.find(profileId, id);
    if (!before) return false;
    await this.db.run('DELETE FROM manual_activities WHERE profile_id = ? AND id = ?', [
      profileId,
      id,
    ]);
    return true;
  }

  async count(profileId: string): Promise<number> {
    const rows = await this.db.query<{ n: number }>(
      'SELECT COUNT(*) AS n FROM manual_activities WHERE profile_id = ?',
      [profileId],
    );
    return rows[0]?.n ?? 0;
  }

  private values(activity: ManualActivity) {
    return [
      activity.sportId,
      activity.localDate,
      activity.startedAt,
      activity.durationS,
      activity.distanceM,
      activity.intensity,
      activity.variant,
      activity.weightKg,
      activity.met,
      activity.metRef,
      activity.metBasis,
      activity.calcMethod,
      activity.calculatedKcal,
      activity.kcal,
      activity.kcalOverridden ? 1 : 0,
    ];
  }
}
