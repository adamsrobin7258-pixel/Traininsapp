import type { SqlExecutor } from '@/core/database';
import type { Calculation } from './calculation/calculate';
import { ACTIVITY_LEVELS, type ActivityLevel, type GoalLevel } from './calculation/parameters';
import { GOAL_TARGETS, type GoalTarget, type GoalType, type NutritionGoal } from './goals';

type GoalRow = {
  id: string;
  profile_id: string;
  effective_from: string;
  goal_type: GoalType;
  goal_level: string | null;
  activity_level: string | null;
  include_training: number;
  target_weight_kg: number | null;
  auto_enabled: number;
  calculation: string | null;
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

const LEVELS: readonly string[] = ['slow', 'moderate', 'fast', 'higher'];

/** A stored calculation that cannot be read (corrupt) is treated as absent, never guessed. */
function parseCalculation(text: string | null): Calculation | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' ? (value as Calculation) : null;
  } catch {
    return null;
  }
}

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
  goalLevel: LEVELS.includes(row.goal_level ?? '') ? (row.goal_level as GoalLevel) : null,
  activityLevel: (ACTIVITY_LEVELS as readonly string[]).includes(row.activity_level ?? '')
    ? (row.activity_level as ActivityLevel)
    : null,
  includeTraining: row.include_training === 1,
  targetWeightKg: num(row.target_weight_kg),
  autoEnabled: row.auto_enabled === 1,
  calculation: parseCalculation(row.calculation),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const VALUE_COLUMNS = GOAL_TARGETS.flatMap((t) => [`${COLUMN[t]}_auto`, `${COLUMN[t]}_manual`]);

const PROFILE_COLUMNS = [
  'goal_level',
  'activity_level',
  'include_training',
  'target_weight_kg',
  'auto_enabled',
  'calculation',
];

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
         ${VALUE_COLUMNS.join(', ')}, ${PROFILE_COLUMNS.join(', ')}, created_at, updated_at)
       VALUES (?, ?, ?, ?, ${[...VALUE_COLUMNS, ...PROFILE_COLUMNS].map(() => '?').join(', ')},
         ?, ?)
       ON CONFLICT (profile_id, effective_from) DO UPDATE SET goal_type = excluded.goal_type,
         ${[...VALUE_COLUMNS, ...PROFILE_COLUMNS].map((c) => `${c} = excluded.${c}`).join(', ')},
         updated_at = excluded.updated_at,
         sync_state = CASE sync_state WHEN 'synced' THEN 'pending' ELSE sync_state END`,
      [
        goal.id,
        goal.profileId,
        goal.effectiveFrom,
        goal.goalType,
        ...values,
        goal.goalLevel,
        goal.activityLevel,
        goal.includeTraining ? 1 : 0,
        goal.targetWeightKg,
        goal.autoEnabled ? 1 : 0,
        goal.calculation ? JSON.stringify(goal.calculation) : null,
        goal.createdAt,
        goal.updatedAt,
      ],
    );
  }
}
