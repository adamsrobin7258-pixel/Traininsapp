import type { Clock } from '@/shared/lib/clock';
import { createId } from '@/shared/lib/id';
import { TrainingError } from './errors';
import { requireName } from './names';
import {
  moveItem,
  nextPlanDay,
  PLAN_NAME_MAX_LENGTH,
  TARGET_LIMITS,
  type NextPlanDay,
  type PlanDetail,
  type TrainingPlan,
} from './plan';
import { DEFAULT_TRAINING_TYPE } from './trainingTypes';
import type { TrainingStore } from './trainingStore';

function optionalTarget(value: number | null, limits: { min: number; max: number }) {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < limits.min || value > limits.max) {
    throw new TrainingError('invalid-value');
  }
  return value;
}

export class PlanService {
  constructor(
    private readonly store: TrainingStore,
    private readonly clock: Clock,
  ) {}

  private now() {
    return this.clock().toISOString();
  }

  listPlans(profileId: string): Promise<TrainingPlan[]> {
    return this.store.repos.plans.listPlans(profileId);
  }

  async getPlan(profileId: string, planId: string): Promise<PlanDetail> {
    const plan = await this.store.repos.plans.findPlan(profileId, planId);
    if (!plan) throw new TrainingError('not-found');
    return plan;
  }

  async createPlan(profileId: string, name: string): Promise<TrainingPlan> {
    const now = this.now();
    const plan: TrainingPlan = {
      id: createId(),
      profileId,
      name: requireName(name, PLAN_NAME_MAX_LENGTH),
      trainingType: DEFAULT_TRAINING_TYPE,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.repos.plans.insertPlan(plan);
    return plan;
  }

  async renamePlan(profileId: string, planId: string, name: string): Promise<void> {
    const ok = await this.store.repos.plans.renamePlan(
      profileId,
      planId,
      requireName(name, PLAN_NAME_MAX_LENGTH),
      this.now(),
    );
    if (!ok) throw new TrainingError('not-found');
  }

  /** Deletes the plan. Workouts started from it keep their snapshot and stay in history. */
  async deletePlan(profileId: string, planId: string): Promise<void> {
    if (!(await this.store.repos.plans.deletePlan(profileId, planId))) {
      throw new TrainingError('not-found');
    }
  }

  async addDay(profileId: string, planId: string, name: string): Promise<string> {
    const plan = await this.getPlan(profileId, planId);
    const id = createId();
    const now = this.now();
    await this.store.atomic(async (repos) => {
      await repos.plans.insertDay(
        { id, planId, name: requireName(name, PLAN_NAME_MAX_LENGTH), position: plan.days.length },
        now,
      );
      await repos.plans.touchPlan(planId, now);
    });
    return id;
  }

  async renameDay(profileId: string, dayId: string, name: string): Promise<void> {
    const owner = await this.requireDay(profileId, dayId);
    const now = this.now();
    await this.store.atomic(async (repos) => {
      await repos.plans.renameDay(dayId, requireName(name, PLAN_NAME_MAX_LENGTH), now);
      await repos.plans.touchPlan(owner.planId, now);
    });
  }

  async deleteDay(profileId: string, dayId: string): Promise<void> {
    const owner = await this.requireDay(profileId, dayId);
    const plan = await this.getPlan(profileId, owner.planId);
    const now = this.now();
    await this.store.atomic(async (repos) => {
      await repos.plans.deleteDay(dayId);
      await repos.plans.setDayPositions(
        plan.days.filter((day) => day.id !== dayId).map((day) => day.id),
        now,
      );
      await repos.plans.touchPlan(owner.planId, now);
    });
  }

  async moveDay(profileId: string, dayId: string, delta: -1 | 1): Promise<void> {
    const owner = await this.requireDay(profileId, dayId);
    const plan = await this.getPlan(profileId, owner.planId);
    const index = plan.days.findIndex((day) => day.id === dayId);
    const ordered = moveItem(plan.days, index, delta).map((day) => day.id);
    const now = this.now();
    await this.store.atomic(async (repos) => {
      await repos.plans.setDayPositions(ordered, now);
      await repos.plans.touchPlan(owner.planId, now);
    });
  }

  async addExercise(profileId: string, dayId: string, exerciseId: string): Promise<string> {
    const owner = await this.requireDay(profileId, dayId);
    const exercise = await this.store.repos.exercises.findById(exerciseId);
    if (!exercise || (exercise.profileId !== null && exercise.profileId !== profileId)) {
      throw new TrainingError('not-found');
    }
    if (!exercise.active) throw new TrainingError('exercise-inactive');
    const plan = await this.getPlan(profileId, owner.planId);
    const day = plan.days.find((d) => d.id === dayId);
    const id = createId();
    const now = this.now();
    await this.store.atomic(async (repos) => {
      await repos.plans.insertPlannedExercise(
        {
          id,
          dayId,
          exerciseId,
          position: day?.exercises.length ?? 0,
          targetSets: null,
          targetReps: null,
        },
        now,
      );
      await repos.plans.touchPlan(owner.planId, now);
    });
    return id;
  }

  async setTargets(
    profileId: string,
    plannedId: string,
    targetSets: number | null,
    targetReps: number | null,
  ): Promise<void> {
    const owner = await this.requirePlanned(profileId, plannedId);
    const sets = optionalTarget(targetSets, TARGET_LIMITS.sets);
    const reps = optionalTarget(targetReps, TARGET_LIMITS.reps);
    const now = this.now();
    await this.store.atomic(async (repos) => {
      await repos.plans.updateTargets(plannedId, sets, reps, now);
      await repos.plans.touchPlan(owner.planId, now);
    });
  }

  async removeExercise(profileId: string, plannedId: string): Promise<void> {
    const owner = await this.requirePlanned(profileId, plannedId);
    const plan = await this.getPlan(profileId, owner.planId);
    const remaining =
      plan.days
        .find((day) => day.id === owner.dayId)
        ?.exercises.filter((e) => e.id !== plannedId)
        .map((e) => e.id) ?? [];
    const now = this.now();
    await this.store.atomic(async (repos) => {
      await repos.plans.deletePlannedExercise(plannedId);
      await repos.plans.setPlannedPositions(remaining, now);
      await repos.plans.touchPlan(owner.planId, now);
    });
  }

  async moveExercise(profileId: string, plannedId: string, delta: -1 | 1): Promise<void> {
    const owner = await this.requirePlanned(profileId, plannedId);
    const plan = await this.getPlan(profileId, owner.planId);
    const exercises = plan.days.find((day) => day.id === owner.dayId)?.exercises ?? [];
    const index = exercises.findIndex((e) => e.id === plannedId);
    const ordered = moveItem(exercises, index, delta).map((e) => e.id);
    const now = this.now();
    await this.store.atomic(async (repos) => {
      await repos.plans.setPlannedPositions(ordered, now);
      await repos.plans.touchPlan(owner.planId, now);
    });
  }

  /**
   * Next day to train: continues the plan used most recently, otherwise starts the most
   * recently edited plan. `null` when there is no plan with days – no invented suggestions.
   */
  async nextWorkout(profileId: string): Promise<NextPlanDay | null> {
    const usage = await this.store.repos.plans.lastPlanUsage(profileId);
    if (usage) {
      const plan = await this.store.repos.plans.findPlan(profileId, usage.planId);
      const next = plan ? nextPlanDay(plan, usage.dayId) : null;
      if (next) return next;
    }
    for (const summary of await this.listPlans(profileId)) {
      const plan = await this.store.repos.plans.findPlan(profileId, summary.id);
      const next = plan ? nextPlanDay(plan, null) : null;
      if (next) return next;
    }
    return null;
  }

  private async requireDay(profileId: string, dayId: string) {
    const owner = await this.store.repos.plans.dayOwner(dayId);
    if (owner?.profileId !== profileId) throw new TrainingError('not-found');
    return owner;
  }

  private async requirePlanned(profileId: string, plannedId: string) {
    const owner = await this.store.repos.plans.plannedOwner(plannedId);
    if (owner?.profileId !== profileId) throw new TrainingError('not-found');
    return owner;
  }
}
