/**
 * Health data imported from the device's health store (Health Connect). Pure TypeScript.
 *
 * Imported values are shown next to Kalethra's own data but never replace it: the user's own
 * weight entries (`weight_entries`) stay the only weight that drives Kalethra's logic, including
 * the nutrition goals. See docs/HEALTH_CONNECT.md.
 */

import type {
  HealthDailyTotal,
  HealthDataKind,
  HealthPlatformId,
  HealthWeightSample,
} from '@/core/platform/health';
import { addDays, startOfDay, toLocalDateKey } from '@/shared/lib/date';
import { isWeightInRange } from './weight';

/** Days read on every sync, today included. Health Connect allows 30 days without extra access. */
export const SYNC_WINDOW_DAYS = 30;

/** Automatic syncs (app start, return to the app, opening a screen) run at most this often. */
export const AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000;

/** Kinds imported into their own tables. `distance` is only read as part of activities. */
export const IMPORTED_KINDS = [
  'weight',
  'steps',
  'activeEnergy',
  'exercise',
] as const satisfies readonly HealthDataKind[];
export type ImportedKind = (typeof IMPORTED_KINDS)[number];

/** Plausible daily totals; values outside are treated as faulty source data and skipped. */
export const ACTIVITY_LIMITS = {
  steps: { min: 0, max: 100_000 },
  activeEnergy: { min: 0, max: 10_000 },
} as const;

/** Measurements more than this far in the future (clock skew) are rejected. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export interface ImportedWeight {
  profileId: string;
  platform: HealthPlatformId;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  kg: number;
  /** Time of the measurement (the earliest of that day), ISO-8601 UTC. */
  measuredAt: string;
  externalId: string | null;
  source: string | null;
}

export interface DailyActivity {
  profileId: string;
  platform: HealthPlatformId;
  date: string;
  steps: number | null;
  activeKcal: number | null;
}

/** One imported weight per day, before it is stored. */
export type ImportedWeightDay = Omit<ImportedWeight, 'profileId' | 'platform'>;

/** One daily total, before it is stored. */
export interface ActivityDay {
  date: string;
  value: number;
}

export interface SyncWindow {
  /** First and last local day of the window, inclusive. */
  fromDate: string;
  toDate: string;
  /** The same window as an instant range for the platform. */
  start: string;
  end: string;
}

/** The last 30 local days including today, up to `now`. */
export function syncWindow(now: Date): SyncWindow {
  const first = addDays(startOfDay(now), -(SYNC_WINDOW_DAYS - 1));
  return {
    fromDate: toLocalDateKey(first),
    toDate: toLocalDateKey(now),
    start: first.toISOString(),
    end: now.toISOString(),
  };
}

function parseInstant(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inWindow(date: string, window: SyncWindow): boolean {
  return date >= window.fromDate && date <= window.toDate;
}

/**
 * The day's earliest valid measurement per local day (08:02 92.4 kg, 12:30 92.8 kg → 92.4 kg).
 * Invalid values (outside 20–400 kg, not a number, unreadable or future time) are skipped, so
 * they cannot displace a valid earlier or later value of the same day.
 */
export function earliestWeightPerDay(
  samples: readonly HealthWeightSample[],
  window: SyncWindow,
  now: Date,
): ImportedWeightDay[] {
  const byDay = new Map<string, { at: Date; day: ImportedWeightDay }>();
  for (const sample of samples) {
    const at = parseInstant(sample.measuredAt);
    if (!at || at.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) continue;
    if (!Number.isFinite(sample.kg) || !isWeightInRange(sample.kg)) continue;
    const date = toLocalDateKey(at);
    if (!inWindow(date, window)) continue;
    const current = byDay.get(date);
    const earlier =
      !current ||
      at.getTime() < current.at.getTime() ||
      // Same instant: a stable choice, so repeated syncs never flip between two records.
      (at.getTime() === current.at.getTime() && (sample.id ?? '') < (current.day.externalId ?? ''));
    if (earlier) {
      byDay.set(date, {
        at,
        day: {
          date,
          kg: sample.kg,
          measuredAt: at.toISOString(),
          externalId: sample.id,
          source: sample.source?.trim() || null,
        },
      });
    }
  }
  return [...byDay.values()].map((entry) => entry.day).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Daily totals as stored values: the local day of each bucket, steps as whole numbers,
 * kilocalories with one decimal. Zero means "no data" and is not stored; implausible values
 * are skipped. Should a bucket ever repeat a day, the larger total wins.
 */
export function dailyTotals(
  totals: readonly HealthDailyTotal[],
  kind: 'steps' | 'activeEnergy',
  window: SyncWindow,
): ActivityDay[] {
  const limits = ACTIVITY_LIMITS[kind];
  const byDay = new Map<string, number>();
  for (const total of totals) {
    const start = parseInstant(total.dayStart);
    if (!start || !Number.isFinite(total.value)) continue;
    const value = kind === 'steps' ? Math.round(total.value) : Math.round(total.value * 10) / 10;
    if (value <= limits.min || value > limits.max) continue;
    const date = toLocalDateKey(start);
    if (!inWindow(date, window)) continue;
    byDay.set(date, Math.max(byDay.get(date) ?? 0, value));
  }
  return [...byDay.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Rule 2 of the weight rules (one place: ./weightRules.ts), kept importable from here.
export { dayWeight, type DayWeight } from './weightRules';
