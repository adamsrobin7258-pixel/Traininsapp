import type { GoalType } from './goals';

/**
 * Compact nutrition figures for the progress main page. Pure. Averages only cover days on which
 * something was logged – a day without entries is unknown, not 0 kcal.
 */

export interface NutritionDayTotals {
  localDate: string;
  energyKcal: number;
  proteinG: number;
}

export interface NutritionDayGoal {
  localDate: string;
  energyKcal: number | null;
  proteinG: number | null;
  /** Main goal in force on that day (decides how the calorie goal is read); `null` without. */
  goalType?: GoalType | null;
}

export interface NutritionPeriodSummary {
  /** Days of the period with at least one entry. */
  loggedDays: number;
  avgKcal: number | null;
  avgProteinG: number | null;
  /** Average goal of the same logged days (only those with a goal); `null` without any. */
  avgGoalKcal: number | null;
  avgGoalProteinG: number | null;
  /** Every day of the period, oldest first; `kcal` is `null` on days without entries. */
  perDay: { date: string; kcal: number | null; goalKcal: number | null }[];
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function summarizeNutrition(
  totals: readonly NutritionDayTotals[],
  goals: readonly NutritionDayGoal[],
  dates: readonly string[],
): NutritionPeriodSummary {
  const logged = totals.filter((day) => dates.includes(day.localDate));
  const goalByDate = new Map(goals.map((goal) => [goal.localDate, goal]));
  const loggedGoals = logged.map((day) => goalByDate.get(day.localDate));
  const kcalByDate = new Map(logged.map((day) => [day.localDate, day.energyKcal]));
  return {
    loggedDays: logged.length,
    avgKcal: average(logged.map((day) => day.energyKcal)),
    avgProteinG: average(logged.map((day) => day.proteinG)),
    avgGoalKcal: average(
      loggedGoals.flatMap((goal) => (goal?.energyKcal != null ? [goal.energyKcal] : [])),
    ),
    avgGoalProteinG: average(
      loggedGoals.flatMap((goal) => (goal?.proteinG != null ? [goal.proteinG] : [])),
    ),
    perDay: dates.map((date) => ({
      date,
      kcal: kcalByDate.has(date) ? Math.round(kcalByDate.get(date) ?? 0) : null,
      goalKcal: goalByDate.get(date)?.energyKcal ?? null,
    })),
  };
}
