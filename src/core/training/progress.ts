/**
 * Compact training figures for the progress main page. Pure; only Kalethra's own completed workouts
 * count – activities imported from Health Connect never appear here.
 */

export interface TrainingDayStats {
  localDate: string;
  workouts: number;
  volumeKg: number;
}

export interface TrainingPeriodSummary {
  workouts: number;
  /** Days with at least one completed workout. */
  trainingDays: number;
  /** Completed sets with load × reps (kg); `null` when no set carried a load. */
  volumeKg: number | null;
  /** One entry per day of the period, oldest first (0 on days without a workout). */
  perDay: { date: string; workouts: number }[];
}

/** Sums the daily figures of a period (`dates`: every local day of it, oldest first). */
export function summarizeTraining(
  days: readonly TrainingDayStats[],
  dates: readonly string[],
): TrainingPeriodSummary {
  const inPeriod = days.filter((day) => dates.includes(day.localDate));
  const byDate = new Map(inPeriod.map((day) => [day.localDate, day.workouts]));
  const volume = inPeriod.reduce((sum, day) => sum + day.volumeKg, 0);
  return {
    workouts: inPeriod.reduce((sum, day) => sum + day.workouts, 0),
    trainingDays: inPeriod.filter((day) => day.workouts > 0).length,
    volumeKg: volume > 0 ? Math.round(volume) : null,
    perDay: dates.map((date) => ({ date, workouts: byDate.get(date) ?? 0 })),
  };
}
