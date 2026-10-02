import { addDays, parseLocalDateKey, toLocalDateKey } from './date';

/** "Dienstag, 30. September" / "Tuesday, September 30" */
export function formatLongDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

/** "Di" / "Tue" */
export function formatShortWeekday(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date).replace('.', '');
}

/** "3. Okt. 2026" / "Oct 3, 2026" */
export function formatMediumDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

/** "03.10." / "10/03" – compact labels for lists and chart axes. */
export function formatDayMonth(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' }).format(date);
}

/** "52 min", "1 h 05 min" – compact and the same in German and English. */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** "Heute", "Gestern" (labels passed in) or a short date such as "Mo., 28.09." */
export function formatRelativeDay(
  localDate: string,
  today: string,
  locale: string,
  labels: { today: string; yesterday: string },
): string {
  if (localDate === today) return labels.today;
  const todayDate = parseLocalDateKey(today);
  if (todayDate && localDate === toLocalDateKey(addDays(todayDate, -1))) return labels.yesterday;
  const date = parseLocalDateKey(localDate);
  if (!date) return localDate;
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: '2-digit' })
    .format(date)
    .replace(/\.$/, '.');
}

/** Water: millilitres below one litre, litres above, e.g. "750 ml", "1,5 l". */
export function formatWater(ml: number, locale: string): string {
  if (ml >= 1000) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(ml / 1000)} l`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(ml)} ml`;
}

/** Whole kcal, e.g. "1.250 kcal". */
export function formatKcal(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)} kcal`;
}

/** Grams with at most one decimal, e.g. "12,5 g". */
export function formatGrams(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} g`;
}
