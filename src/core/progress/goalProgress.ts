/**
 * Goal attainment of a period for the progress page (Phase 14): what was set as a goal
 * (Einstellungen) against what was tracked. Pure – the UI gets these ready-made values and does
 * no calculation of its own.
 *
 * Nothing here is a second goal or score logic:
 * - weekly targets are spread over the period with `weeklyExpectation` (the score's definition),
 *   each day with the target version in force on it;
 * - calories and protein use `calorieGoalStatus` / `proteinGoalStatus` (core/nutrition), the same
 *   thresholds as the score;
 * - steps use `summarizeStepGoal` (core/health); they are not part of the score.
 * Missing data stays missing: days without food or step data are neither 0 nor a miss.
 */
import {
  calorieGoalKind,
  calorieGoalStatus,
  proteinGoalStatus,
  summarizeNutrition,
  type CalorieGoalKind,
  type CalorieGoalStatus,
  type NutritionDayGoal,
  type NutritionDayTotals,
  type NutritionPeriodSummary,
  type ProteinGoalStatus,
} from '@/core/nutrition';
import type { StepGoalSummary } from '@/core/health';
import { weeklyExpectation, type TargetValue } from '@/core/targets';

/** Actual against target. The bar never goes beyond 100 %, the actual value stays visible. */
export interface Attainment {
  actual: number;
  target: number;
  /** actual ÷ target, not capped (5 of 4 → 1.25). */
  ratio: number;
  /** For a bar: 0…1. */
  shownRatio: number;
  /** Whole percent of the uncapped ratio. */
  percent: number;
}

export function attainment(actual: number, target: number): Attainment | null {
  if (!(target > 0) || !Number.isFinite(actual) || actual < 0) return null;
  const ratio = actual / target;
  return {
    actual,
    target,
    ratio,
    shownRatio: Math.min(1, ratio),
    percent: Math.round(ratio * 100),
  };
}

const oneDecimal = (value: number) => Math.round(value * 10) / 10;

/** The first day with a target when the target does not cover the whole period, else `null`. */
function coveredSince(days: ReadonlySet<string>, dates: readonly string[]): string | null {
  if (days.size === dates.length) return null;
  return dates.find((date) => days.has(date)) ?? null;
}

// ── Training ──────────────────────────────────────────────────────────────────

export type TrainingGoalProgress =
  /** No weekly target: only the completed workouts. */
  | { mode: 'none'; done: number }
  /**
   * Fewer than 7 days under a target (the "Heute" period, or a target set only recently): no
   * fair weekly expectation yet – like the score, no ratio, and no workout today is no minus.
   */
  | { mode: 'short'; done: number; weeklyTarget: number }
  | {
      mode: 'full';
      /** Completed Kalethra workouts on the days with a target. */
      done: number;
      weeklyTarget: number;
      /** Expected workouts in the period (sum of the day targets ÷ 7), one decimal. */
      expected: number;
      /** First day of the target when it does not cover the whole period. */
      targetSince: string | null;
      attainment: Attainment;
    };

/**
 * Completed Kalethra workouts against the weekly target – Health Connect and manual activities
 * never count (they are not in `workoutsPerDay`). Same expectation and "fewer than 7 days" rule
 * as the score's training area.
 */
export function trainingGoalProgress(
  workoutsPerDay: readonly { localDate: string; workouts: number }[],
  dates: readonly string[],
  target: TargetValue,
): TrainingGoalProgress {
  const workoutsOn = (include: (date: string) => boolean) =>
    workoutsPerDay
      .filter((day) => include(day.localDate))
      .reduce((sum, day) => sum + day.workouts, 0);
  const plan = weeklyExpectation(target, dates);
  if (plan.latest === null) {
    return { mode: 'none', done: workoutsOn((date) => dates.includes(date)) };
  }
  const done = workoutsOn((date) => plan.days.has(date));
  const expected = oneDecimal(plan.expected);
  const reached = attainment(done, expected);
  if (plan.days.size < 7 || !reached) return { mode: 'short', done, weeklyTarget: plan.latest };
  return {
    mode: 'full',
    done,
    weeklyTarget: plan.latest,
    expected,
    targetSince: coveredSince(plan.days, dates),
    attainment: reached,
  };
}

// ── Activities ────────────────────────────────────────────────────────────────

export type ActivityGoalProgress =
  | { mode: 'none'; minutes: number }
  /** A target, but no activity in the period: not tracked is not the same as not active. */
  | { mode: 'noData'; weeklyTarget: number; expectedMinutes: number; targetSince: string | null }
  | {
      mode: 'full';
      /** Countable active minutes on the days with a target. */
      minutes: number;
      weeklyTarget: number;
      /** Expected minutes in the period (sum of the day targets ÷ 7), whole minutes. */
      expectedMinutes: number;
      targetSince: string | null;
      attainment: Attainment;
    };

/**
 * Active minutes against the weekly target. `minutesPerDay` are the countable minutes of the
 * score (`countableActivityMinutes`: manual + Health Connect, a duplicate once, no session that
 * is a Kalethra workout) – no second, simplified count.
 */
export function activityGoalProgress(
  minutesPerDay: readonly { localDate: string; minutes: number }[],
  dates: readonly string[],
  target: TargetValue,
): ActivityGoalProgress {
  const minutesOn = (include: (date: string) => boolean) =>
    Math.round(
      minutesPerDay
        .filter((day) => include(day.localDate) && day.minutes > 0)
        .reduce((sum, day) => sum + day.minutes, 0),
    );
  const plan = weeklyExpectation(target, dates);
  if (plan.latest === null) return { mode: 'none', minutes: minutesOn((d) => dates.includes(d)) };
  const minutes = minutesOn((date) => plan.days.has(date));
  const expectedMinutes = Math.round(plan.expected);
  const targetSince = coveredSince(plan.days, dates);
  const reached = attainment(minutes, plan.expected);
  if (minutes === 0 || !reached) {
    return { mode: 'noData', weeklyTarget: plan.latest, expectedMinutes, targetSince };
  }
  return {
    mode: 'full',
    minutes,
    weeklyTarget: plan.latest,
    expectedMinutes,
    targetSince,
    attainment: attainment(minutes, expectedMinutes) ?? reached,
  };
}

// ── Nutrition ─────────────────────────────────────────────────────────────────

export interface CalorieGoalProgress {
  /** How the goal is read (main goal on the last day of the period): limit, minimum or range. */
  kind: CalorieGoalKind;
  /** Average of the logged days with a calorie goal, and their average goal. */
  avgKcal: number;
  avgGoalKcal: number;
  /** Logged days with a goal that can be judged (today below the goal is still open). */
  ratedDays: number;
  withinDays: number;
  aboveDays: number;
  belowDays: number;
  /** Today's status when today is in the period and logged; else `null`. */
  today: CalorieGoalStatus | null;
}

export interface ProteinGoalProgress {
  avgG: number;
  avgGoalG: number;
  ratedDays: number;
  reachedDays: number;
  attainment: Attainment;
  today: ProteinGoalStatus | null;
}

export interface NutritionGoalProgress {
  /** Averages over the logged days only (`summarizeNutrition`). */
  summary: NutritionPeriodSummary;
  /** `null` without a logged day that has a calorie goal. */
  calories: CalorieGoalProgress | null;
  /** `null` without a logged day that has a protein goal. */
  protein: ProteinGoalProgress | null;
}

const average = (values: readonly number[]) =>
  values.length === 0
    ? null
    : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

/**
 * Calories and protein against the day goals (`GoalService.dayGoalsBetween`: manual before
 * automatic, own protein target, activity calories only on days the switch was on, each day with
 * the goal version in force then). Only logged days count – a day without entries is no 0 kcal.
 */
export function nutritionGoalProgress(
  totals: readonly NutritionDayTotals[],
  goals: readonly NutritionDayGoal[],
  dates: readonly string[],
  today: string,
): NutritionGoalProgress {
  const summary = summarizeNutrition(totals, goals, dates);
  const goalByDate = new Map(goals.map((goal) => [goal.localDate, goal]));
  const logged = totals.filter((day) => dates.includes(day.localDate));
  const lastDate = dates.at(-1);
  const kind = calorieGoalKind(
    lastDate === undefined ? null : (goalByDate.get(lastDate)?.goalType ?? null),
  );

  const kcal = { eaten: [] as number[], goal: [] as number[], within: 0, above: 0, below: 0 };
  const protein = { eaten: [] as number[], goal: [] as number[], rated: 0, reached: 0 };
  let kcalToday: CalorieGoalStatus | null = null;
  let proteinToday: ProteinGoalStatus | null = null;
  for (const day of logged) {
    const goal = goalByDate.get(day.localDate);
    const isToday = day.localDate === today;
    const kcalStatus = calorieGoalStatus(
      goal?.goalType ?? null,
      day.energyKcal,
      goal?.energyKcal ?? null,
      isToday,
    );
    if (kcalStatus !== null && goal?.energyKcal != null) {
      kcal.eaten.push(day.energyKcal);
      kcal.goal.push(goal.energyKcal);
      if (kcalStatus === 'within') kcal.within++;
      if (kcalStatus === 'above') kcal.above++;
      if (kcalStatus === 'below') kcal.below++;
      if (isToday) kcalToday = kcalStatus;
    }
    const proteinStatus = proteinGoalStatus(day.proteinG, goal?.proteinG ?? null, isToday);
    if (proteinStatus !== null && goal?.proteinG != null) {
      protein.eaten.push(day.proteinG);
      protein.goal.push(goal.proteinG);
      if (proteinStatus !== 'open') protein.rated++;
      if (proteinStatus === 'reached') protein.reached++;
      if (isToday) proteinToday = proteinStatus;
    }
  }
  const avgKcal = average(kcal.eaten);
  const avgGoalKcal = average(kcal.goal);
  const avgProtein = average(protein.eaten);
  const avgGoalProtein = average(protein.goal);
  const proteinAttainment =
    avgProtein !== null && avgGoalProtein !== null ? attainment(avgProtein, avgGoalProtein) : null;
  return {
    summary,
    calories:
      avgKcal !== null && avgGoalKcal !== null
        ? {
            kind,
            avgKcal,
            avgGoalKcal,
            ratedDays: kcal.within + kcal.above + kcal.below,
            withinDays: kcal.within,
            aboveDays: kcal.above,
            belowDays: kcal.below,
            today: kcalToday,
          }
        : null,
    protein:
      avgProtein !== null && avgGoalProtein !== null && proteinAttainment
        ? {
            avgG: avgProtein,
            avgGoalG: avgGoalProtein,
            ratedDays: protein.rated,
            reachedDays: protein.reached,
            attainment: proteinAttainment,
            today: proteinToday,
          }
        : null,
  };
}

// ── Steps ─────────────────────────────────────────────────────────────────────

/**
 * Average steps against the average daily goal of the days that have both – days without step
 * data are left out instead of counting as 0 steps. `null` without such a day.
 */
export function stepGoalProgress(summary: StepGoalSummary): {
  summary: StepGoalSummary;
  attainment: Attainment | null;
} {
  return {
    summary,
    attainment:
      summary.avgRatedSteps !== null && summary.avgGoal !== null
        ? attainment(summary.avgRatedSteps, summary.avgGoal)
        : null,
  };
}
