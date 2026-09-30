import { addDays, isLocalDateKey, parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';

/** The day shown on the Today screen: a valid past day or today, never the future. */
export function resolveSelectedDay(requested: string | null, today: string): string {
  if (requested && isLocalDateKey(requested) && requested <= today) return requested;
  return today;
}

/** Moves the selection by whole weeks; moving forward stops at today. */
export function shiftByWeeks(day: string, weeks: number, today: string): string {
  const date = parseLocalDateKey(day);
  if (!date) return today;
  const target = toLocalDateKey(addDays(date, weeks * 7));
  return target > today ? today : target;
}
