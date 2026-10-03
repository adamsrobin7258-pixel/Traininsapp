import { addDays, parseLocalDateKey } from '@/shared/lib/date';

/**
 * Steps against the daily step goal (Einstellungen → Ziele → Gesundheit) – the one step
 * evaluation for Gesundheit, Fortschritt and the score (Phase 16). Steps come only from Health
 * Connect (`daily_activity.steps`); a day without a value is unknown and neither reached nor
 * missed. Each day uses the goal that applied on that day, and counts with its share of the goal
 * capped at 100 % – today as well (proportional, not "open"). Several days: the mean of the
 * rated days' shares. Pure. (The score passes the steps outside tracked activities –
 * `countableStepsPerDay` in core/activity; with daily totals they equal the real steps.)
 */
export interface StepDay {
  date: string;
  steps: number | null;
}

/**
 * The time span of a stored daily step total: the whole local day (Health Connect is read in
 * day buckets – there is no finer time information). `null` for a malformed day.
 */
export function stepDaySpan(date: string): { startedAt: string; endedAt: string } | null {
  const day = parseLocalDateKey(date);
  if (!day) return null;
  return { startedAt: day.toISOString(), endedAt: addDays(day, 1).toISOString() };
}

/** One day's steps against its goal: 0 → 0, 9.000 / 10.000 → 0.9, 12.000 / 10.000 → 1. */
export function stepDayRatio(steps: number, goal: number): number {
  return goal > 0 ? Math.min(1, Math.max(0, steps) / goal) : 0;
}

export interface StepGoalSummary {
  /** Today's steps against today's goal (`ratio` capped at 1); `null` without a goal today. */
  today: { steps: number | null; goal: number; ratio: number | null } | null;
  /** Days with a goal and a step value … */
  ratedDays: number;
  /** … and those on which the goal was reached. */
  reachedDays: number;
  /** Days of the period with a step value (a day without one is unknown, never 0 steps). */
  daysWithData: number;
  /** Average steps over the days with a value; `null` without any. */
  avgSteps: number | null;
  /** Average goal of the rated days (each with its own version) … */
  avgGoal: number | null;
  /** … and the average steps of the same days; both `null` without a rated day. */
  avgRatedSteps: number | null;
  /** Mean of the rated days' shares of their goal (each capped at 1); `null` without one. */
  avgRatio: number | null;
  /** The goal in force on the last day of the period; `null` without one. */
  latestGoal: number | null;
}

export function summarizeStepGoal(
  days: readonly StepDay[],
  dates: readonly string[],
  goalOn: (date: string) => number | null,
): StepGoalSummary {
  const steps = new Map(days.map((day) => [day.date, day.steps]));
  let ratedDays = 0;
  let reachedDays = 0;
  let goalSum = 0;
  let ratedSteps = 0;
  let ratioSum = 0;
  const values: number[] = [];
  for (const date of dates) {
    const goal = goalOn(date);
    const value = steps.get(date) ?? null;
    if (value !== null) values.push(value);
    if (goal === null || value === null) continue;
    ratedDays++;
    goalSum += goal;
    ratedSteps += value;
    ratioSum += stepDayRatio(value, goal);
    if (value >= goal) reachedDays++;
  }
  const today = dates.at(-1);
  const todayGoal = today ? goalOn(today) : null;
  const todaySteps = today ? (steps.get(today) ?? null) : null;
  return {
    today:
      todayGoal === null
        ? null
        : {
            steps: todaySteps,
            goal: todayGoal,
            ratio: todaySteps === null ? null : stepDayRatio(todaySteps, todayGoal),
          },
    ratedDays,
    reachedDays,
    daysWithData: values.length,
    avgSteps:
      values.length > 0
        ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
        : null,
    avgGoal: ratedDays > 0 ? Math.round(goalSum / ratedDays) : null,
    avgRatedSteps: ratedDays > 0 ? Math.round(ratedSteps / ratedDays) : null,
    avgRatio: ratedDays > 0 ? ratioSum / ratedDays : null,
    latestGoal: todayGoal,
  };
}
