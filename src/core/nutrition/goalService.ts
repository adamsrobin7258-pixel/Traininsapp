import type { Clock } from '@/shared/lib/clock';
import { isLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { createId } from '@/shared/lib/id';
import { NutritionError } from './errors';
import {
  effectiveTargets,
  EMPTY_GOAL_VALUE,
  GOAL_LIMITS,
  GOAL_TARGETS,
  GOAL_TYPES,
  goalForDate,
  type EffectiveGoalValue,
  type GoalTarget,
  type GoalType,
  type GoalValue,
  type NutritionGoal,
} from './goals';
import type { NutritionStore } from './nutritionStore';

export interface GoalInput {
  /** First day the goal applies to; defaults to today. */
  effectiveFrom?: string;
  goalType: GoalType;
  targets: Partial<Record<GoalTarget, GoalValue>>;
}

export interface GoalForDay {
  goal: NutritionGoal;
  effective: Record<GoalTarget, EffectiveGoalValue>;
}

/** Dated nutrition goals with automatic and manual values. */
export class GoalService {
  constructor(
    private readonly store: NutritionStore,
    private readonly clock: Clock,
  ) {}

  list(profileId: string): Promise<NutritionGoal[]> {
    return this.store.repos.goals.list(profileId);
  }

  /** The goal in force on a day (or `null`), with manual values taking precedence. */
  async goalFor(profileId: string, localDate: string): Promise<GoalForDay | null> {
    const goal = goalForDate(await this.list(profileId), localDate);
    return goal ? { goal, effective: effectiveTargets(goal) } : null;
  }

  /** Saves the goal starting on a day; a goal for the same start day is replaced. */
  async save(profileId: string, input: GoalInput): Promise<NutritionGoal> {
    const effectiveFrom = input.effectiveFrom ?? toLocalDateKey(this.clock());
    if (!isLocalDateKey(effectiveFrom) || !GOAL_TYPES.includes(input.goalType)) {
      throw new NutritionError('invalid-value');
    }
    const targets = Object.fromEntries(
      GOAL_TARGETS.map((target) => [
        target,
        checked(target, input.targets[target] ?? EMPTY_GOAL_VALUE),
      ]),
    ) as NutritionGoal['targets'];
    const now = this.clock().toISOString();
    const existing = (await this.list(profileId)).find((g) => g.effectiveFrom === effectiveFrom);
    const goal: NutritionGoal = {
      id: existing?.id ?? createId(),
      profileId,
      effectiveFrom,
      goalType: input.goalType,
      targets,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.store.atomic((repos) => repos.goals.upsert(goal));
    return goal;
  }

  /**
   * Overrides (or with `null` resets to automatic) one value of the goal in force on
   * `localDate`. The automatic value is kept, so a later recalculation does not lose it.
   */
  async setManual(
    profileId: string,
    localDate: string,
    target: GoalTarget,
    manual: number | null,
  ): Promise<NutritionGoal> {
    const current = await this.goalFor(profileId, localDate);
    if (!current) throw new NutritionError('not-found');
    return this.save(profileId, {
      effectiveFrom: current.goal.effectiveFrom,
      goalType: current.goal.goalType,
      targets: { ...current.goal.targets, [target]: { ...current.goal.targets[target], manual } },
    });
  }
}

function checked(target: GoalTarget, value: GoalValue): GoalValue {
  const { min, max } = GOAL_LIMITS[target];
  for (const part of [value.auto, value.manual]) {
    if (part !== null && (!Number.isFinite(part) || part < min || part > max)) {
      throw new NutritionError('invalid-value');
    }
  }
  return { auto: value.auto, manual: value.manual };
}
