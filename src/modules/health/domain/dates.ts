import { parseLocalDateKey } from '@/shared/lib/date';
import { formatDayMonth, formatLongDate, formatMediumDate } from '@/shared/lib/format';

function toDate(key: string): Date {
  const date = parseLocalDateKey(key);
  if (!date) throw new Error(`Invalid date key ${key}`);
  return date;
}

export const longDate = (key: string, locale: string) => formatLongDate(toDate(key), locale);
export const mediumDate = (key: string, locale: string) => formatMediumDate(toDate(key), locale);
export const shortDate = (key: string, locale: string) => formatDayMonth(toDate(key), locale);
