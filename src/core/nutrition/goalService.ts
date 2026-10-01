import type { Clock } from '@/shared/lib/clock';
import { addDays, isLocalDateKey, parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { createId } from '@/shared/lib/id';
import { NutritionError } from './errors';
import {
  effectiveTargets,
  EMPTY_GOAL_VALUE,
  GOAL_LIMITS,
  GOAL_TARGETS,
  OVERRIDE_LIMITS,
  GOAL_TYPES,
  goalForDate,
  type EffectiveGoalValue,
  type GoalTarget,
  type GoalType,
  type GoalValue,
  type NutritionGoal,
} from './goals';
import type { NutritionSources } from './bodyWeight';
import {
  calculateNutrition,
  levelFor,
  MACRO_TARGETS,
  type MacroTarget,
  type Calculation,
  type Overrides,
  type PersonalData,
  type ProfileParams,
} from './calculation/calculate';
import { ACTIVITY_LEVELS, INPUT_LIMITS, TRAINING, WEIGHT_TREND } from './calculation/parameters';
import type { NutritionStore } from './nutritionStore';

export interface GoalInput {
  /** First day the goal applies to; defaults to today. */
  effectiveFrom?: string;
  goalType: GoalType;
  targets: Partial<Record<GoalTarget, GoalValue>>;
}

/** A complete nutrition profile as the user sets it. */
export interface NutritionProfileInput {
  params: ProfileParams;
  /** Manual values; `null`/missing = calculated automatically. */
  overrides: Overrides;
  /** Daily water goal in ml (always set by the user). */
  waterMl: number | null;
}

/** What the profile screen shows: the stored profile and a fresh calculation of it. */
export interface NutritionProfileState {
  /** The version in force today, `null` before the first setup. */
  current: NutritionGoal | null;
  /** Latest weighing on or before today (display only). */
  latestWeight: { date: string; kg: number } | null;
}

export interface GoalForDay {
  goal: NutritionGoal;
  effective: Record<GoalTarget, EffectiveGoalValue>;
}

/**
 * The nutrition profile and its dated versions. Every change starts a new version on the day
 * it is made; past days keep the version (and values) that applied then.
 */
export class GoalService {
  constructor(
    private readonly store: NutritionStore,
    private readonly clock: Clock,
    private readonly sources: NutritionSources,
  ) {}

  private today(): string {
    return toLocalDateKey(this.clock());
  }

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
      goalLevel: null,
      activityLevel: null,
      includeTraining: false,
      targetWeightKg: null,
      autoEnabled: false,
      calculation: null,
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

  // ── Nutrition profile (automatic goals) ─────────────────────────────────

  /** The profile in force today and the latest weighing. */
  async profileState(profileId: string): Promise<NutritionProfileState> {
    const today = this.today();
    const [goal, latest] = await Promise.all([
      this.goalFor(profileId, today),
      this.sources.bodyWeight.latestOnOrBefore(profileId, today),
    ]);
    return { current: goal?.goal ?? null, latestWeight: latest };
  }

  /**
   * Runs the calculation for a profile on a day (today by default) with the current personal
   * data, weight trend and training – without saving anything (used for previews).
   */
  async calculate(
    profileId: string,
    params: ProfileParams,
    overrides: Overrides,
    onDate: string = this.today(),
    /** Unsaved personal data to preview with (defaults to the stored profile). */
    personalDraft?: PersonalData,
  ): Promise<Calculation> {
    const day = parseLocalDateKey(onDate);
    if (!day) throw new NutritionError('invalid-value');
    const shift = (days: number) => toLocalDateKey(addDays(day, days));
    const [personal, recent, latest, training] = await Promise.all([
      personalDraft ?? this.sources.personal.get(profileId),
      this.sources.bodyWeight.pointsBetween(
        profileId,
        shift(-(WEIGHT_TREND.windowDays - 1)),
        onDate,
      ),
      this.sources.bodyWeight.latestOnOrBefore(profileId, onDate),
      this.sources.training.sessionsBetween(profileId, shift(-(TRAINING.windowDays - 1)), onDate),
    ]);
    const weights = recent.length > 0 || !latest ? recent : [latest];
    return calculateNutrition({ onDate, personal, params, weights, training, overrides });
  }

  /**
   * Saves the nutrition profile as the version starting today (a version started earlier today
   * is replaced). Automatic values come from the calculation; manual values are kept as given.
   */
  async saveProfile(profileId: string, input: NutritionProfileInput): Promise<NutritionGoal> {
    const params = checkedParams(input.params);
    const overrides = checkedOverrides(input.overrides);
    const calculation = await this.calculate(profileId, params, overrides);
    return this.storeVersion(profileId, params, overrides, input.waterMl, calculation);
  }

  /**
   * Sets an own value for one target of the stored profile – or with `null` returns it to the
   * automatic calculation – and saves it right away as today's version. Everything else (goal,
   * activity, other own values, water) stays as stored; the automatic values are recalculated
   * from the current weight trend. A later recalculation keeps the own value (see
   * refreshAutomatic); only the user removes it again.
   */
  async setProfileOverride(
    profileId: string,
    target: MacroTarget,
    value: number | null,
  ): Promise<NutritionGoal> {
    const current = (await this.goalFor(profileId, this.today()))?.goal;
    if (!current?.autoEnabled) throw new NutritionError('not-found');
    const params: ProfileParams = {
      goalType: current.goalType,
      goalLevel: current.goalLevel,
      activityLevel: current.activityLevel,
      includeTraining: current.includeTraining,
      targetWeightKg: current.targetWeightKg,
    };
    const overrides = checkedOverrides({
      ...(Object.fromEntries(
        MACRO_TARGETS.map((key) => [key, current.targets[key].manual]),
      ) as Overrides),
      [target]: value,
    });
    const calculation = await this.calculate(profileId, params, overrides);
    return this.storeVersion(
      profileId,
      params,
      overrides,
      current.targets.waterMl.manual,
      calculation,
    );
  }

  /**
   * Re-calculates today's automatic values after new weight, training or personal data. A new
   * version is stored only when the weight trend moved by at least 0.5 kg or the calorie target
   * by at least 50 kcal (or the calculation became possible), so a single weighing or small
   * fluctuations never change the goal. Manual values are never touched.
   */
  async refreshAutomatic(profileId: string): Promise<'updated' | 'unchanged' | 'none'> {
    const current = (await this.goalFor(profileId, this.today()))?.goal;
    if (!current?.autoEnabled) return 'none';
    const params: ProfileParams = {
      goalType: current.goalType,
      goalLevel: current.goalLevel,
      activityLevel: current.activityLevel,
      includeTraining: current.includeTraining,
      targetWeightKg: current.targetWeightKg,
    };
    const overrides = Object.fromEntries(
      MACRO_TARGETS.map((target) => [target, current.targets[target].manual]),
    ) as Overrides;
    const next = await this.calculate(profileId, params, overrides);
    if (!hasRelevantChange(current, next)) return 'unchanged';
    await this.storeVersion(profileId, params, overrides, current.targets.waterMl.manual, next);
    return 'updated';
  }

  private async storeVersion(
    profileId: string,
    params: ProfileParams,
    overrides: Overrides,
    waterMl: number | null,
    calculation: Calculation,
  ): Promise<NutritionGoal> {
    const effectiveFrom = this.today();
    const targets = {
      energyKcal: { auto: calculation.auto.energyKcal, manual: overrides.energyKcal ?? null },
      proteinG: { auto: calculation.auto.proteinG, manual: overrides.proteinG ?? null },
      carbsG: { auto: calculation.auto.carbsG, manual: overrides.carbsG ?? null },
      fatG: { auto: calculation.auto.fatG, manual: overrides.fatG ?? null },
      waterMl: { auto: null, manual: waterMl },
    };
    for (const target of GOAL_TARGETS) checked(target, targets[target]);
    const now = this.clock().toISOString();
    const existing = (await this.list(profileId)).find((g) => g.effectiveFrom === effectiveFrom);
    const goal: NutritionGoal = {
      id: existing?.id ?? createId(),
      profileId,
      effectiveFrom,
      goalType: params.goalType,
      targets,
      goalLevel: levelFor(params.goalType, params.goalLevel),
      activityLevel: params.activityLevel,
      includeTraining: params.includeTraining,
      targetWeightKg: params.targetWeightKg,
      autoEnabled: true,
      calculation,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.store.atomic((repos) => repos.goals.upsert(goal));
    return goal;
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

function checkedParams(params: ProfileParams): ProfileParams {
  const { min, max } = INPUT_LIMITS.targetWeightKg;
  if (
    !GOAL_TYPES.includes(params.goalType) ||
    (params.activityLevel !== null && !ACTIVITY_LEVELS.includes(params.activityLevel)) ||
    (params.targetWeightKg !== null &&
      (!Number.isFinite(params.targetWeightKg) ||
        params.targetWeightKg < min ||
        params.targetWeightKg > max))
  ) {
    throw new NutritionError('invalid-value');
  }
  return { ...params, goalLevel: levelFor(params.goalType, params.goalLevel) };
}

/** Own values the user enters; protein has its own, narrower range (OVERRIDE_LIMITS). */
function checkedOverrides(overrides: Overrides): Overrides {
  const result: Overrides = {};
  for (const target of MACRO_TARGETS) {
    const value = overrides[target] ?? null;
    const { min, max } = OVERRIDE_LIMITS[target];
    if (value !== null && (!Number.isFinite(value) || value < min || value > max)) {
      throw new NutritionError('invalid-value');
    }
    result[target] = value;
  }
  return result;
}

/** Whether a new calculation differs enough from the stored one to start a new version. */
function hasRelevantChange(current: NutritionGoal, next: Calculation): boolean {
  const previous = current.calculation;
  if (!previous || previous.status !== next.status) return true;
  const before = previous.inputs.weight?.kg;
  const after = next.inputs.weight?.kg;
  if ((before === undefined) !== (after === undefined)) return true;
  if (before !== undefined && after !== undefined) {
    if (Math.abs(after - before) >= WEIGHT_TREND.minChangeKg) return true;
  }
  const energyBefore = current.targets.energyKcal.auto;
  const energyAfter = next.auto.energyKcal;
  if ((energyBefore === null) !== (energyAfter === null)) return true;
  return (
    energyBefore !== null &&
    energyAfter !== null &&
    Math.abs(energyAfter - energyBefore) >= WEIGHT_TREND.minEnergyChangeKcal
  );
}
