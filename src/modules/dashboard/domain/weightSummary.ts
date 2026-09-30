import { addDays, parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';

interface Entry {
  date: string;
  kg: number;
}

/** Days shown in the small trend on Today, and the window for "change since". */
export const TREND_DAYS = 90;
export const CHANGE_DAYS = 30;

export interface WeightSummary {
  latest: Entry | null;
  /** Change from the first entry within the last 30 days to the latest; needs two entries. */
  change: { deltaKg: number; since: string } | null;
  /** Polyline points in a 100 × 32 box (x by date, y by weight), `null` below two entries. */
  trendPoints: string | null;
}

/**
 * Condenses weight entries (ascending by date) for the Today screen. Pure and unit-free: the
 * weight stays in kilograms; the screen formats it in the user's unit.
 */
export function summarizeWeight(entries: readonly Entry[], today: string): WeightSummary {
  const todayDate = parseLocalDateKey(today);
  const within = (days: number) =>
    todayDate
      ? entries.filter((e) => e.date >= toLocalDateKey(addDays(todayDate, -days)))
      : [...entries];
  const latest = entries.at(-1) ?? null;
  const recent = within(CHANGE_DAYS);
  const first = recent[0];
  const change =
    latest && first && first.date !== latest.date
      ? { deltaKg: latest.kg - first.kg, since: first.date }
      : null;
  return { latest, change, trendPoints: trendPoints(within(TREND_DAYS)) };
}

const WIDTH = 100;
const HEIGHT = 32;
const PADDING = 3;

function dayNumber(date: string): number {
  return (parseLocalDateKey(date)?.getTime() ?? 0) / 86_400_000;
}

function trendPoints(entries: readonly Entry[]): string | null {
  if (entries.length < 2) return null;
  const first = entries[0];
  const last = entries.at(-1);
  if (!first || !last) return null;
  const x0 = dayNumber(first.date);
  const span = Math.max(dayNumber(last.date) - x0, 1);
  const values = entries.map((e) => e.kg);
  const min = Math.min(...values);
  const range = Math.max(...values) - min;
  return entries
    .map((entry) => {
      const x = ((dayNumber(entry.date) - x0) / span) * WIDTH;
      // Flat line in the middle when all values are equal.
      const y =
        range === 0
          ? HEIGHT / 2
          : PADDING + (1 - (entry.kg - min) / range) * (HEIGHT - 2 * PADDING);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
