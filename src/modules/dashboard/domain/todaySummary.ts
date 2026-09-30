/**
 * Key figures shown on the dashboard. `null` means "no data yet".
 * In later phases the activity, nutrition and training modules provide these values
 * through their public APIs; the dashboard never reads their tables directly.
 */
export interface TodaySummary {
  steps: number | null;
  energyKcal: number | null;
  trainingMinutes: number | null;
}

export const EMPTY_TODAY_SUMMARY: TodaySummary = {
  steps: null,
  energyKcal: null,
  trainingMinutes: null,
};

export function formatSummaryValue(value: number | null, locale: string): string | null {
  return value === null ? null : new Intl.NumberFormat(locale).format(value);
}
