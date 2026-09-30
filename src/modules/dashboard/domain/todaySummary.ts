/**
 * Key figures shown on the dashboard. `null` means "no data yet".
 * Training minutes come from the training domain (core/training); steps and energy follow
 * with activity and nutrition. The dashboard never reads other tables directly.
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
