import type { SqlExecutor } from '@/core/database';
import type { PlanDay, PlanDetail, PlannedExercise, PlannedTargets, TrainingPlan } from './plan';

interface PlanRow {
  id: string;
  profile_id: string;
  name: string;
  training_type: string;
  created_at: string;
  updated_at: string;
}

interface DayRow {
  id: string;
  plan_id: string;
  name: string;
  position: number;
}

interface PlannedRow {
  id: string;
  day_id: string;
  exercise_id: string;
  position: number;
  target_sets: number | null;
  target_reps: number | null;
  warmup_sets: number | null;
  drop_sets: number | null;
}

const toPlan = (row: PlanRow): TrainingPlan => ({
  id: row.id,
  profileId: row.profile_id,
  name: row.name,
  trainingType: row.training_type,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toDay = (row: DayRow): PlanDay => ({
  id: row.id,
  planId: row.plan_id,
  name: row.name,
  position: row.position,
});

const toPlanned = (row: PlannedRow): PlannedExercise => ({
  id: row.id,
  dayId: row.day_id,
  exerciseId: row.exercise_id,
  position: row.position,
  targetSets: row.target_sets,
  targetReps: row.target_reps,
  warmupSets: row.warmup_sets,
  dropSets: row.drop_sets,
});

/** SQL for plans, days and planned exercises. Every query is scoped to the profile. */
export class PlanRepository {
  constructor(private readonly db: SqlExecutor) {}

  async listPlans(profileId: string): Promise<TrainingPlan[]> {
    const rows = await this.db.query<PlanRow>(
      'SELECT * FROM training_plans WHERE profile_id = ? ORDER BY updated_at DESC',
      [profileId],
    );
    return rows.map(toPlan);
  }

  async findPlan(profileId: string, planId: string): Promise<PlanDetail | null> {
    const plans = await this.db.query<PlanRow>(
      'SELECT * FROM training_plans WHERE id = ? AND profile_id = ?',
      [planId, profileId],
    );
    const plan = plans[0];
    if (!plan) return null;
    const days = await this.db.query<DayRow>(
      'SELECT * FROM training_plan_days WHERE plan_id = ? ORDER BY position',
      [planId],
    );
    const planned = await this.db.query<PlannedRow>(
      `SELECT pe.* FROM planned_exercises pe
       JOIN training_plan_days d ON d.id = pe.day_id
       WHERE d.plan_id = ? ORDER BY pe.position`,
      [planId],
    );
    return {
      ...toPlan(plan),
      days: days.map((day) => ({
        ...toDay(day),
        exercises: planned.filter((p) => p.day_id === day.id).map(toPlanned),
      })),
    };
  }

  async insertPlan(plan: TrainingPlan): Promise<void> {
    await this.db.run(
      `INSERT INTO training_plans (id, profile_id, name, training_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [plan.id, plan.profileId, plan.name, plan.trainingType, plan.createdAt, plan.updatedAt],
    );
  }

  async renamePlan(profileId: string, planId: string, name: string, now: string) {
    const result = await this.db.run(
      'UPDATE training_plans SET name = ?, updated_at = ? WHERE id = ? AND profile_id = ?',
      [name, now, planId, profileId],
    );
    return result.changes === 1;
  }

  async touchPlan(planId: string, now: string): Promise<void> {
    await this.db.run('UPDATE training_plans SET updated_at = ? WHERE id = ?', [now, planId]);
  }

  /** Deletes the plan with its days; workouts keep their snapshot (plan_id → NULL). */
  async deletePlan(profileId: string, planId: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM training_plans WHERE id = ? AND profile_id = ?', [
      planId,
      profileId,
    ]);
    // > 0, not === 1: the native plugin also counts rows removed or cleared by foreign keys.
    return result.changes > 0;
  }

  async insertDay(day: PlanDay, now: string): Promise<void> {
    await this.db.run(
      `INSERT INTO training_plan_days (id, plan_id, name, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [day.id, day.planId, day.name, day.position, now, now],
    );
  }

  async renameDay(dayId: string, name: string, now: string): Promise<boolean> {
    const result = await this.db.run(
      'UPDATE training_plan_days SET name = ?, updated_at = ? WHERE id = ?',
      [name, now, dayId],
    );
    return result.changes === 1;
  }

  async deleteDay(dayId: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM training_plan_days WHERE id = ?', [dayId]);
    // > 0, not === 1: the native plugin also counts rows removed or cleared by foreign keys.
    return result.changes > 0;
  }

  async setDayPositions(orderedIds: readonly string[], now: string): Promise<void> {
    for (const [position, id] of orderedIds.entries()) {
      await this.db.run('UPDATE training_plan_days SET position = ?, updated_at = ? WHERE id = ?', [
        position,
        now,
        id,
      ]);
    }
  }

  async insertPlannedExercise(planned: PlannedExercise, now: string): Promise<void> {
    await this.db.run(
      `INSERT INTO planned_exercises (id, day_id, exercise_id, position, target_sets, target_reps,
         warmup_sets, drop_sets, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        planned.id,
        planned.dayId,
        planned.exerciseId,
        planned.position,
        planned.targetSets,
        planned.targetReps,
        planned.warmupSets,
        planned.dropSets,
        now,
        now,
      ],
    );
  }

  async updateTargets(id: string, targets: PlannedTargets, now: string) {
    const result = await this.db.run(
      `UPDATE planned_exercises SET target_sets = ?, target_reps = ?, warmup_sets = ?,
         drop_sets = ?, updated_at = ? WHERE id = ?`,
      [targets.targetSets, targets.targetReps, targets.warmupSets, targets.dropSets, now, id],
    );
    return result.changes === 1;
  }

  async deletePlannedExercise(id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM planned_exercises WHERE id = ?', [id]);
    return result.changes === 1;
  }

  async setPlannedPositions(orderedIds: readonly string[], now: string): Promise<void> {
    for (const [position, id] of orderedIds.entries()) {
      await this.db.run('UPDATE planned_exercises SET position = ?, updated_at = ? WHERE id = ?', [
        position,
        now,
        id,
      ]);
    }
  }

  /** Owning plan and profile of a day (used by the service to authorise changes). */
  async dayOwner(dayId: string): Promise<{ planId: string; profileId: string } | null> {
    const rows = await this.db.query<{ plan_id: string; profile_id: string }>(
      `SELECT d.plan_id, p.profile_id FROM training_plan_days d
       JOIN training_plans p ON p.id = d.plan_id WHERE d.id = ?`,
      [dayId],
    );
    const row = rows[0];
    return row ? { planId: row.plan_id, profileId: row.profile_id } : null;
  }

  async plannedOwner(
    id: string,
  ): Promise<{ dayId: string; planId: string; profileId: string } | null> {
    const rows = await this.db.query<{ day_id: string; plan_id: string; profile_id: string }>(
      `SELECT pe.day_id, d.plan_id, p.profile_id FROM planned_exercises pe
       JOIN training_plan_days d ON d.id = pe.day_id
       JOIN training_plans p ON p.id = d.plan_id WHERE pe.id = ?`,
      [id],
    );
    const row = rows[0];
    return row ? { dayId: row.day_id, planId: row.plan_id, profileId: row.profile_id } : null;
  }
}
