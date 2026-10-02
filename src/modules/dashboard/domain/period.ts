import { addDays, startOfDay, toLocalDateKey } from '@/shared/lib/date';

/** "Woche" and "Monat" on Today: the last 7 or 30 local days including today. */
export const PROGRESS_PERIODS = ['week', 'month'] as const;
export type ProgressPeriod = (typeof PROGRESS_PERIODS)[number];

const PERIOD_DAYS: Record<ProgressPeriod, number> = { week: 7, month: 30 };

export interface PeriodRange {
  from: string;
  to: string;
  /** Every local day of the period, oldest first. */
  dates: string[];
}

/** Rolling window ending today – a calendar week would be almost empty on Mondays. */
export function periodRange(now: Date, period: ProgressPeriod): PeriodRange {
  const today = startOfDay(now);
  const days = PERIOD_DAYS[period];
  const dates = Array.from({ length: days }, (_, index) =>
    toLocalDateKey(addDays(today, index - (days - 1))),
  );
  return { from: dates[0] ?? toLocalDateKey(today), to: toLocalDateKey(today), dates };
}

/** Workouts per week over the period, one decimal ("Ø 2,3 pro Woche"). */
export function perWeek(count: number, period: ProgressPeriod): number {
  return Math.round((count / PERIOD_DAYS[period]) * 7 * 10) / 10;
}
