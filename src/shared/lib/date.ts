/** 0 = Sunday … 6 = Saturday (same as Date#getDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DayPeriod = 'morning' | 'afternoon' | 'evening';

/** Maps the local hour to a greeting period. */
export function getDayPeriod(date: Date): DayPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 18) return 'afternoon';
  return 'evening';
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Start of the week containing `date`. Defaults to Monday (ISO 8601). */
export function startOfWeek(date: Date, weekStartsOn: Weekday = 1): Date {
  const offset = (date.getDay() - weekStartsOn + 7) % 7;
  return addDays(startOfDay(date), -offset);
}

/** The seven days of the week containing `date`, in display order. */
export function getWeekDays(date: Date, weekStartsOn: Weekday = 1): Date[] {
  const start = startOfWeek(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

/** Local calendar date as YYYY-MM-DD (stable key for daily records). */
export function toLocalDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses a YYYY-MM-DD key into a local date; `null` for malformed or impossible dates. */
export function parseLocalDateKey(key: string): Date | null {
  const match = DATE_KEY.exec(key);
  if (!match) return null;
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const date = new Date(year, month - 1, day);
  return toLocalDateKey(date) === key ? date : null;
}

export function isLocalDateKey(value: string): boolean {
  return parseLocalDateKey(value) !== null;
}
