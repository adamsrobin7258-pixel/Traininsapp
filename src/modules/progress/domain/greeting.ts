import type { TranslateFn } from '@/core/i18n';
import { getDayPeriod } from '@/shared/lib/date';

/** "Guten Morgen, Anna" – or just "Guten Morgen" when no name is set. */
export function buildGreeting(t: TranslateFn, now: Date, displayName: string | null): string {
  const greeting = t(`progress.greeting.${getDayPeriod(now)}`);
  return displayName ? t('progress.greetingWithName', { greeting, name: displayName }) : greeting;
}
