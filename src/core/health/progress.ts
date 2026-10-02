/**
 * Compact weight and activity figures for the Today screen. Pure.
 *
 * Weight: one value per day – the user's own entry wins over a value imported from Health
 * Connect (`dayWeight`). This is display only; nutrition goals keep reading the own entries.
 * Activities: imported Health Connect sessions, never Kalethra workouts.
 */

import type { ExternalWorkout } from './externalWorkouts';
import type { ImportedWeight } from './importedHealth';

export interface WeightDay {
  date: string;
  kg: number;
  source: 'own' | 'imported';
}

/** One weight per day, ascending by date; own entries take precedence over imported ones. */
export function mergeWeightDays(
  own: readonly { date: string; kg: number }[],
  imported: readonly Pick<ImportedWeight, 'date' | 'kg'>[],
): WeightDay[] {
  const byDate = new Map<string, WeightDay>();
  for (const entry of imported) byDate.set(entry.date, { ...entry, source: 'imported' });
  for (const entry of own)
    byDate.set(entry.date, { date: entry.date, kg: entry.kg, source: 'own' });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface ActivityPeriodSummary {
  count: number;
  durationS: number;
  /** Sum of the reported active calories; `null` when no activity reported any. */
  activeKcal: number | null;
  /** Active minutes per day of the period, oldest first (0 on days without activity). */
  perDay: { date: string; minutes: number }[];
  /** Days with at least one activity. */
  activeDays: number;
}

/** Totals of imported activities in a period; each record counts once. */
export function summarizeActivities(
  activities: readonly Pick<
    ExternalWorkout,
    'externalId' | 'localDate' | 'durationS' | 'activeKcal'
  >[],
  dates: readonly string[],
): ActivityPeriodSummary {
  const unique = new Map(
    activities
      .filter((activity) => dates.includes(activity.localDate))
      .map((activity) => [activity.externalId, activity]),
  );
  const list = [...unique.values()];
  const withKcal = list.filter((activity) => activity.activeKcal !== null);
  const seconds = new Map<string, number>();
  for (const activity of list) {
    seconds.set(activity.localDate, (seconds.get(activity.localDate) ?? 0) + activity.durationS);
  }
  return {
    count: list.length,
    durationS: list.reduce((sum, activity) => sum + activity.durationS, 0),
    activeKcal:
      withKcal.length > 0
        ? Math.round(withKcal.reduce((sum, activity) => sum + (activity.activeKcal ?? 0), 0))
        : null,
    perDay: dates.map((date) => ({ date, minutes: Math.round((seconds.get(date) ?? 0) / 60) })),
    activeDays: seconds.size,
  };
}

export interface WeightPeriodSummary {
  /** The most recent value at all (it may be older than the period). */
  latest: WeightDay | null;
  /** Last minus first value within the period; needs two days with a value in it. */
  changeKg: number | null;
  /** Values within the period, ascending. */
  points: WeightDay[];
}

/** `days` ascending (see `mergeWeightDays`); `from`/`to` are the period's first and last day. */
export function summarizeWeightPeriod(
  days: readonly WeightDay[],
  from: string,
  to: string,
): WeightPeriodSummary {
  const points = days.filter((day) => day.date >= from && day.date <= to);
  const first = points[0];
  const last = points.at(-1);
  return {
    latest: days.filter((day) => day.date <= to).at(-1) ?? null,
    changeKg:
      first && last && first.date !== last.date ? Math.round((last.kg - first.kg) * 10) / 10 : null,
    points,
  };
}
