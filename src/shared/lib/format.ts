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
