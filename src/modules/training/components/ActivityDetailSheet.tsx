import { isSameSession, type ExternalWorkout } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useTrainingData } from '@/core/training';
import { addDays, parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { formatDuration, formatMediumDate } from '@/shared/lib/format';
import { List, ListRow, Sheet } from '@/ui';
import {
  activityTime,
  activityTypeLabel,
  formatActivityKcal,
  formatDistance,
} from '../domain/activities';
import styles from './ActivityDetailSheet.module.css';

/** Everything the source delivered for one imported activity – nothing invented. */
export function ActivityDetailSheet({
  activity,
  onClose,
}: {
  activity: ExternalWorkout;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const day = parseLocalDateKey(activity.localDate);
  // Same check as the calorie budget: does this overlap a completed Kalethra workout?
  const overlap = useTrainingData(
    async (s, profileId) => {
      if (!day) return false;
      const own = await s.workouts.completedSpansBetween(
        profileId,
        toLocalDateKey(addDays(day, -1)),
        toLocalDateKey(addDays(day, 1)),
      );
      return own.some((workout) => isSameSession(activity, workout));
    },
    [activity.id, activity.startedAt, activity.endedAt],
  );
  const number = new Intl.NumberFormat(locale);

  return (
    <Sheet title={t('activities.detailTitle')} onClose={onClose} closeLabel={t('common.close')}>
      <List label={t('activities.detailTitle')}>
        <ListRow
          title={t('activities.activity')}
          value={activityTypeLabel(activity.activityType, t)}
        />
        <ListRow
          title={t('activities.date')}
          value={day ? formatMediumDate(day, locale) : activity.localDate}
        />
        <ListRow title={t('activities.start')} value={activityTime(activity.startedAt, locale)} />
        <ListRow title={t('activities.duration')} value={formatDuration(activity.durationS)} />
        {activity.activeKcal !== null ? (
          <ListRow
            title={t('activities.activeKcal')}
            value={formatActivityKcal(activity.activeKcal, locale, t)}
          />
        ) : null}
        {activity.distanceM !== null && activity.distanceM > 0 ? (
          <ListRow
            title={t('activities.distance')}
            value={formatDistance(activity.distanceM, locale, t)}
          />
        ) : null}
        {activity.steps !== null ? (
          <ListRow
            title={t('activities.stepsLabel')}
            value={t('activities.steps', { value: number.format(activity.steps) })}
          />
        ) : null}
        <ListRow
          title={t('activities.source')}
          value={
            activity.source
              ? t('activities.sourceValue', { source: activity.source })
              : t('activities.sourceUnknown')
          }
        />
      </List>
      <p className={styles.note}>{t('activities.separate')}</p>
      {overlap.status === 'ready' && overlap.data ? (
        <p className={styles.note}>{t('activities.sameSession')}</p>
      ) : null}
    </Sheet>
  );
}
