/**
 * Three deliberately different ways Kalethra reads body weight. They answer different questions
 * and are NOT to be merged into one "current weight":
 *
 * 1. Nutrition goals – own entries only (`weight_entries`), smoothed as the median of the last
 *    7 days (`trendWeight`, core/nutrition/calculation/trend.ts); the protein reference weight
 *    caps it at BMI 27.5. Imported values never change a nutrition goal.
 * 2. Display (progress weight card, Health Connect overview) – own and Health Connect values
 *    side by side, one per day, the own entry wins on the same day (`mergeWeightDays` for a
 *    period, `dayWeight` for one day, below). Display only.
 * 3. Activity calories (MET estimate of a manual activity) – the most recent value on or before
 *    the day: the own entry, or a Health Connect value if that is newer (the own entry wins on
 *    the same day), imported values at most `ACTIVITY_WEIGHT_WINDOW_DAYS` old
 *    (`pickActivityWeight`, below). Stored with the activity as a snapshot.
 *
 * Pure. Every module reads weight through these functions (or `trendWeight` for rule 1); none
 * repeats the rules.
 */

import type { ImportedWeight } from './importedHealth';

// ── Rule 2: display ───────────────────────────────────────────────────────────

export interface WeightDay {
  date: string;
  kg: number;
  source: 'own' | 'imported';
}

/** Rule 2 for a period: one weight per day, ascending by date; the own entry wins. */
export function mergeWeightDays(
  own: readonly { date: string; kg: number }[],
  imported: readonly Pick<ImportedWeight, 'date' | 'kg'>[],
): WeightDay[] {
  const byDate = new Map<string, WeightDay>();
  for (const entry of imported)
    byDate.set(entry.date, { date: entry.date, kg: entry.kg, source: 'imported' });
  for (const entry of own)
    byDate.set(entry.date, { date: entry.date, kg: entry.kg, source: 'own' });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** The weight a day shows: the user's own entry always wins over an imported value. */
export type DayWeight =
  | { kind: 'own'; kg: number; imported: ImportedWeight | null }
  | { kind: 'imported'; kg: number; imported: ImportedWeight }
  | { kind: 'none' };

/** Rule 2 for one day. */
export function dayWeight(ownKg: number | null, imported: ImportedWeight | null): DayWeight {
  if (ownKg !== null) return { kind: 'own', kg: ownKg, imported };
  if (imported) return { kind: 'imported', kg: imported.kg, imported };
  return { kind: 'none' };
}

// ── Rule 3: activity calories ─────────────────────────────────────────────────

/** Imported weights older than this are not used for activity calories. */
export const ACTIVITY_WEIGHT_WINDOW_DAYS = 60;

export interface ActivityWeightChoice {
  kg: number;
  date: string;
  source: 'own' | 'imported';
}

/**
 * Rule 3: the weight for a manual activity on a day. `own` is the latest own entry on or before
 * the day; `imported` are the Health Connect values of the window, ascending by date.
 */
export function pickActivityWeight(
  own: { date: string; kg: number } | null,
  imported: readonly { date: string; kg: number }[],
): ActivityWeightChoice | null {
  const latestImported = imported.at(-1) ?? null;
  if (own && (!latestImported || own.date >= latestImported.date)) {
    return { kg: own.kg, date: own.date, source: 'own' };
  }
  return latestImported
    ? { kg: latestImported.kg, date: latestImported.date, source: 'imported' }
    : null;
}
