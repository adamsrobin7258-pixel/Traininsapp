import { sportById, sportName, type ActivityEntry } from '@/core/activity';
import { activityTypeLabel, type ExternalWorkout } from '@/core/health';
import type { TranslateFn } from '@/core/i18n';
import { formatDuration, formatRelativeDay } from '@/shared/lib/format';

export { activityTypeLabel };

/** "Heute · 18:20", "Gestern · 07:05", "Mo., 28.09. · 18:20" – or the day alone without a time. */
export function activityWhen(
  activity: { localDate: string; startedAt: string | null },
  today: string,
  locale: string,
  t: TranslateFn,
): string {
  const day = formatRelativeDay(activity.localDate, today, locale, {
    today: t('activities.today'),
    yesterday: t('activities.yesterday'),
  });
  if (!activity.startedAt) return day;
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

/** Name of a list entry: the sport (manual) or the Health Connect type. */
export function entryTitle(entry: ActivityEntry, locale: string, t: TranslateFn): string {
  if (entry.source === 'healthConnect') return activityTypeLabel(entry.activity.activityType, t);
  const sport = sportById(entry.activity.sportId);
  return sport ? sportName(sport, locale) : entry.activity.sportId;
}

/** "Heute · 18:00 / 90 min · 620 kcal / Manuell erfasst" – three short lines. */
export function entrySubtitle(
  entry: ActivityEntry,
  today: string,
  locale: string,
  t: TranslateFn,
): string {
  const facts =
    entry.source === 'healthConnect'
      ? activityFacts(entry.activity, locale, t)
      : activityFacts(
          {
            durationS: entry.activity.durationS,
            distanceM: entry.activity.distanceM,
            activeKcal: entry.activity.kcal,
          },
          locale,
          t,
        );
  const source =
    entry.source === 'healthConnect'
      ? entry.activity.source
        ? t('activities.sourceValue', { source: entry.activity.source })
        : t('activities.sourceUnknown')
      : t('activities.sourceManual');
  return [activityWhen(entry.activity, today, locale, t), facts, source].join('\n');
}
