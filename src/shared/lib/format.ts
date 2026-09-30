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
