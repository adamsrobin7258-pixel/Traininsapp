/**
 * Three deliberately different ways Kalethra reads body weight. They answer different questions
 * and are NOT to be merged into one "current weight":
 *
 * 1. Nutrition goals – own entries only (`weight_entries`), smoothed as the median of the last
 *    7 days (`trendWeight`, core/nutrition/calculation/trend.ts); the protein reference weight
 *    caps it at BMI 27.5. Imported values never change a nutrition goal.
 * 2. Progress (weight card) – own and Health Connect values side by side, one per day, the own
 *    entry wins on the same day (`mergeWeightDays`, ./progress.ts). Display only.
 * 3. Activity calories (MET estimate of a manual activity) – the most recent value on or before
 *    the day: the own entry, or a Health Connect value if that is newer (the own entry wins on
 *    the same day), imported values at most `ACTIVITY_WEIGHT_WINDOW_DAYS` old
 *    (`pickActivityWeight`, below). Stored with the activity as a snapshot.
 *
 * Pure.
 */

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
