/**
 * Steps against the daily step goal (Einstellungen → Ziele → Gesundheit). Steps come only from
 * Health Connect (`daily_activity.steps`); a day without a value is unknown and neither reached
 * nor missed. Each day uses the goal that applied on that day. Pure; not part of the score.
 */
export interface StepDay {
  date: string;
  steps: number | null;
}

export interface StepGoalSummary {
  /** Today's steps against today's goal; `null` without a goal today. */
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
  const values: number[] = [];
  for (const date of dates) {
    const goal = goalOn(date);
    const value = steps.get(date) ?? null;
    if (value !== null) values.push(value);
    if (goal === null || value === null) continue;
    ratedDays++;
    goalSum += goal;
    ratedSteps += value;
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
            ratio: todaySteps === null ? null : todaySteps / todayGoal,
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
    latestGoal: todayGoal,
  };
}
