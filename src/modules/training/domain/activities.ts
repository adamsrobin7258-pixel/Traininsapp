import type { TranslateFn, TranslationKey } from '@/core/i18n';
import { NAMED_ACTIVITY_TYPES, readableActivityType, type ExternalWorkout } from '@/core/health';
import { formatDuration, formatRelativeDay } from '@/shared/lib/format';

/**
 * Name of an imported activity: Kalethra's translation for known types, otherwise the
 * provider's own name made readable – an unknown type is never mapped to another sport.
 */
export function activityTypeLabel(type: string, t: TranslateFn): string {
  if (type === 'other' || NAMED_ACTIVITY_TYPES.includes(type)) {
    return t(`activities.types.${type}` as TranslationKey);
  }
  return readableActivityType(type);
}

/** "Heute · 18:20", "Gestern · 07:05", "Mo., 28.09. · 18:20". */
export function activityWhen(
  activity: Pick<ExternalWorkout, 'localDate' | 'startedAt'>,
  today: string,
  locale: string,
  t: TranslateFn,
): string {
  const day = formatRelativeDay(activity.localDate, today, locale, {
    today: t('activities.today'),
    yesterday: t('activities.yesterday'),
  });
  return t('activities.when', { day, time: activityTime(activity.startedAt, locale) });
}

export function activityTime(instant: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(instant),
  );
}

export function formatDistance(meters: number, locale: string, t: TranslateFn): string {
  const value = new Intl.NumberFormat(locale, {
    minimumFractionDigits: meters < 100_000 ? 1 : 0,
    maximumFractionDigits: meters < 100_000 ? 1 : 0,
  }).format(meters / 1000);
  return t('activities.km', { value });
}

export function formatActivityKcal(kcal: number, locale: string, t: TranslateFn): string {
  return t('activities.kcal', { value: new Intl.NumberFormat(locale).format(Math.round(kcal)) });
}

/**
 * The facts a source delivered, in a fixed order: "42 min · 5,8 km · 386 kcal". Missing values
 * are left out – never shown as 0.
 */
export function activityFacts(
  activity: Pick<ExternalWorkout, 'durationS' | 'distanceM' | 'activeKcal'>,
  locale: string,
  t: TranslateFn,
): string {
  const parts = [formatDuration(activity.durationS)];
  if (activity.distanceM !== null && activity.distanceM > 0) {
    parts.push(formatDistance(activity.distanceM, locale, t));
  }
  if (activity.activeKcal !== null) parts.push(formatActivityKcal(activity.activeKcal, locale, t));
  return parts.join(' · ');
}
