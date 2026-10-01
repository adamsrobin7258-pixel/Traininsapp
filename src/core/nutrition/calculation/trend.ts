import { addDays, parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { WEIGHT_TREND } from './parameters';

export interface WeightPoint {
  /** Local day YYYY-MM-DD. */
  date: string;
  kg: number;
}

export interface WeightTrend {
  /** Weight the calculation uses. */
  kg: number;
  /**
   * `median7`: median of the entries in the 7-day window up to the day;
   * `latest`: no entry in that window – the latest earlier entry is used as is.
   */
  method: 'median7' | 'latest';
  /** Entries the value is based on. */
  entryCount: number;
  /** Most recent measurement on or before the day. */
  latest: WeightPoint;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * Smoothed weight for a day: the median of the last 7 days' entries, so a single unusual
 * reading does not move the goal. With no entry in the window the latest earlier value is used
 * and marked as such; without any entry there is no trend (nothing is invented).
 */
export function weightTrend(points: readonly WeightPoint[], onDate: string): WeightTrend | null {
  const day = parseLocalDateKey(onDate);
  if (!day) return null;
  const from = toLocalDateKey(addDays(day, -(WEIGHT_TREND.windowDays - 1)));
  const valid = points
    .filter((p) => p.date <= onDate && Number.isFinite(p.kg) && p.kg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = valid.at(-1);
  if (!latest) return null;
  const window = valid.filter((p) => p.date >= from);
  if (window.length === 0) return { kg: latest.kg, method: 'latest', entryCount: 1, latest };
  return {
    kg: Math.round(median(window.map((p) => p.kg)) * 10) / 10,
    method: 'median7',
    entryCount: window.length,
    latest,
  };
}
