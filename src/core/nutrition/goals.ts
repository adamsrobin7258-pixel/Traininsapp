import type { Calculation } from './calculation/calculate';
import type { ActivityLevel, GoalLevel } from './calculation/parameters';

/**
 * Daily nutrition goals. Each value keeps an automatically calculated and a manual part:
 * the manual value overrides the automatic one, so a later automatic calculation can run
 * without discarding the user's own numbers. Goals are dated (`effectiveFrom`): a past day is
 * judged by the goal that applied then.
 */
export const GOAL_TYPES = ['lose', 'maintain', 'gain'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_TARGETS = ['energyKcal', 'proteinG', 'carbsG', 'fatG', 'waterMl'] as const;
export type GoalTarget = (typeof GOAL_TARGETS)[number];

export interface GoalValue {
  auto: number | null;
  manual: number | null;
}

/**
 * One version of the nutrition profile, valid from `effectiveFrom` until the next version
 * starts (there is no stored end date – the next start is the end). Past days are always judged
 * by the version that applied then.
 */
export interface NutritionGoal {
  id: string;
  profileId: string;
  /** First local day (YYYY-MM-DD) this goal applies to. */
  effectiveFrom: string;
  goalType: GoalType;
  targets: Record<GoalTarget, GoalValue>;
  /** Pace of the goal (`null` for maintain or goals from before the nutrition profile). */
  goalLevel: GoalLevel | null;
  activityLevel: ActivityLevel | null;
  /** Whether logged workouts count towards the energy need (off by default). */
  includeTraining: boolean;
  targetWeightKg: number | null;
  /** Automatic values come from the calculation; `false` for purely manual goals. */
  autoEnabled: boolean;
  /** How the automatic values came about (inputs, intermediate values, results). */
  calculation: Calculation | null;
  createdAt: string;
  updatedAt: string;
}

export type GoalOrigin = 'manual' | 'auto';

export interface EffectiveGoalValue {
  value: number | null;
  origin: GoalOrigin | null;
}

/** The value that counts: manual beats automatic; `null` when neither is set. */
export function effectiveValue(goal: GoalValue): EffectiveGoalValue {
  if (goal.manual !== null) return { value: goal.manual, origin: 'manual' };
  if (goal.auto !== null) return { value: goal.auto, origin: 'auto' };
  return { value: null, origin: null };
}

export function effectiveTargets(
  goal: Pick<NutritionGoal, 'targets'>,
): Record<GoalTarget, EffectiveGoalValue> {
  return Object.fromEntries(
    GOAL_TARGETS.map((target) => [target, effectiveValue(goal.targets[target])]),
  ) as Record<GoalTarget, EffectiveGoalValue>;
}

/** Goal in force on `localDate`: the latest one that started on or before it. */
export function goalForDate<T extends Pick<NutritionGoal, 'effectiveFrom'>>(
  goals: readonly T[],
  localDate: string,
): T | null {
  return (
    [...goals]
      .filter((goal) => goal.effectiveFrom <= localDate)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ?? null
  );
}

export const EMPTY_GOAL_VALUE: GoalValue = { auto: null, manual: null };

/** Plausibility limits per target (per day). */
export const GOAL_LIMITS: Record<GoalTarget, { min: number; max: number }> = {
  energyKcal: { min: 500, max: 10_000 },
  proteinG: { min: 0, max: 1_000 },
  carbsG: { min: 0, max: 2_000 },
  fatG: { min: 0, max: 1_000 },
  waterMl: { min: 0, max: 10_000 },
};

export interface GoalProgress {
  /** Share of the goal reached, 0–1 (capped; use `over` for the excess). */
  ratio: number;
  /** Still open up to the goal (0 once reached). */
  remaining: number;
  /** Amount above the goal (0 while below). */
  over: number;
}

/** Progress of a day's value towards a goal. Neutral numbers, no judgement. */
export function goalProgress(value: number, goal: number): GoalProgress {
  const safeValue = Math.max(0, value);
  return {
    ratio: goal > 0 ? Math.min(1, safeValue / goal) : safeValue > 0 ? 1 : 0,
    remaining: Math.max(0, goal - safeValue),
    over: Math.max(0, safeValue - goal),
  };
}
