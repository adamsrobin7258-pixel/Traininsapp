import type { SqlExecutor } from '@/core/database';
import { GOAL_TARGETS, type GoalTarget, type GoalType, type NutritionGoal } from './goals';

type GoalRow = {
  id: string;
  profile_id: string;
  effective_from: string;
  goal_type: GoalType;
  created_at: string;
  updated_at: string;
} & Record<string, string | number | null>;

const COLUMN: Record<GoalTarget, string> = {
  energyKcal: 'energy_kcal',
  proteinG: 'protein_g',
  carbsG: 'carbs_g',
  fatG: 'fat_g',
  waterMl: 'water_ml',
};

const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);

const toGoal = (row: GoalRow): NutritionGoal => ({
  id: row.id,
  profileId: row.profile_id,
  effectiveFrom: row.effective_from,
  goalType: row.goal_type,
  targets: Object.fromEntries(
    GOAL_TARGETS.map((target) => [
      target,
      { auto: num(row[`${COLUMN[target]}_auto`]), manual: num(row[`${COLUMN[target]}_manual`]) },
    ]),
  ) as NutritionGoal['targets'],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const VALUE_COLUMNS = GOAL_TARGETS.flatMap((t) => [`${COLUMN[t]}_auto`, `${COLUMN[t]}_manual`]);

/** SQL for dated nutrition goals (one row per profile and start day). */
export class GoalRepository {
  constructor(private readonly db: SqlExecutor) {}

  async list(profileId: string): Promise<NutritionGoal[]> {
    const rows = await this.db.query<GoalRow>(
      'SELECT * FROM nutrition_goals WHERE profile_id = ? ORDER BY effective_from',
      [profileId],
    );
    return rows.map(toGoal);
  }

  /** Inserts or replaces the goal starting on `effectiveFrom` (id and created_at are kept). */
  async upsert(goal: NutritionGoal): Promise<void> {
    const values = GOAL_TARGETS.flatMap((t) => [goal.targets[t].auto, goal.targets[t].manual]);
    await this.db.run(
      `INSERT INTO nutrition_goals (id, profile_id, effective_from, goal_type,
         ${VALUE_COLUMNS.join(', ')}, created_at, updated_at)
       VALUES (?, ?, ?, ?, ${VALUE_COLUMNS.map(() => '?').join(', ')}, ?, ?)
       ON CONFLICT (profile_id, effective_from) DO UPDATE SET goal_type = excluded.goal_type,
         ${VALUE_COLUMNS.map((c) => `${c} = excluded.${c}`).join(', ')},
         updated_at = excluded.updated_at,
         sync_state = CASE sync_state WHEN 'synced' THEN 'pending' ELSE sync_state END`,
      [
        goal.id,
        goal.profileId,
        goal.effectiveFrom,
        goal.goalType,
        ...values,
        goal.createdAt,
        goal.updatedAt,
      ],
    );
  }
}
