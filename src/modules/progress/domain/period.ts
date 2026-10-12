import { addDays, startOfDay, startOfWeek, toLocalDateKey } from '@/shared/lib/date';

/**
 * "Heute", "7 Tage" and "30 Tage" on the progress page: today, or the last 7 or 30 local days
 * including today.
 */
export const PROGRESS_PERIODS = ['today', 'week', 'month'] as const;
export type ProgressPeriod = (typeof PROGRESS_PERIODS)[number];

export const PERIOD_DAYS: Record<ProgressPeriod, number> = { today: 1, week: 7, month: 30 };

export interface PeriodRange {
  from: string;
  to: string;
  /** Every local day of the period, oldest first. */
  dates: string[];
}

function rangeEnding(end: Date, days: number): PeriodRange {
  const dates = Array.from({ length: days }, (_, index) =>
    toLocalDateKey(addDays(end, index - (days - 1))),
  );
  return { from: dates[0] ?? toLocalDateKey(end), to: toLocalDateKey(end), dates };
}

/** Rolling window ending today – a calendar week would be almost empty on Mondays. */
export function periodRange(now: Date, period: ProgressPeriod): PeriodRange {
  return rangeEnding(startOfDay(now), PERIOD_DAYS[period]);
}

/**
 * The comparable period right before: yesterday for today, the 7 days before the last 7, the 30
 * days before the last 30.
 */
export function previousPeriodRange(now: Date, period: ProgressPeriod): PeriodRange {
  const days = PERIOD_DAYS[period];
  return rangeEnding(addDays(startOfDay(now), -days), days);
}

/** Workouts per week over the period, one decimal ("Ø 2,3 pro Woche"). */
export function perWeek(count: number, period: ProgressPeriod): number {
  return Math.round((count / PERIOD_DAYS[period]) * 7 * 10) / 10;
}

/**
 * The day calendar under the score (Phase 24): the current calendar week and the two before –
 * always whole weeks, Monday first, as everywhere in Kalethra.
 */
export const CALENDAR_WEEKS = 3;

export interface CalendarRange {
  /** Monday two weeks ago … Sunday of this week (local days, YYYY-MM-DD), oldest first. */
  dates: string[];
  from: string;
  to: string;
  /** Today's local day. */
  today: string;
  /** The days up to and including today – the only ones with data; later days are future. */
  untilToday: string[];
}

/** Local calendar days only (`addDays` keeps the wall-clock date), so no UTC shift at midnight. */
export function calendarRange(now: Date): CalendarRange {
  const start = addDays(startOfWeek(now), -7 * (CALENDAR_WEEKS - 1));
  const dates = Array.from({ length: 7 * CALENDAR_WEEKS }, (_, index) =>
    toLocalDateKey(addDays(start, index)),
  );
  const today = toLocalDateKey(startOfDay(now));
  return {
    dates,
    from: dates[0] ?? today,
    to: dates.at(-1) ?? today,
    today,
    untilToday: dates.filter((date) => date <= today),
  };
}
