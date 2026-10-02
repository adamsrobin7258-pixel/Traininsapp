import { TRAINING_LINKS } from '@/app/routes';
import { activityTypeLabel, useImportedHealthData } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { toLocalDateKey } from '@/shared/lib/date';
import { formatDuration } from '@/shared/lib/format';
import { OverviewCard, OverviewNote, OverviewValue } from './OverviewCard';

/**
 * Activities imported from Health Connect today, in one line ("Laufen · 42 min" or
 * "3 Aktivitäten · 1 h 24 min"). Nothing is shown on days without; the list itself stays under
 * Training → Aktivitäten.
 */
export function ActivitiesSummary({ now }: { now: Date }) {
  const { t, locale } = useI18n();
  const today = toLocalDateKey(now);
  const data = useImportedHealthData(
    (service, profileId) => service.workoutsBetween(profileId, today, today),
    [today],
  );
  if (data.status !== 'ready' || data.data.length === 0) return null;
  const list = data.data;
  const seconds = list.reduce((sum, activity) => sum + activity.durationS, 0);
  const withKcal = list.filter((activity) => activity.activeKcal !== null);
  const kcal = withKcal.reduce((sum, activity) => sum + (activity.activeKcal ?? 0), 0);
  const [single] = list;

  return (
    <OverviewCard
      icon="flame"
      title={t('dashboard.activities.title')}
      to={TRAINING_LINKS.activities}
    >
      <OverviewValue>
        {list.length === 1 && single
          ? t('dashboard.activities.single', {
              type: activityTypeLabel(single.activityType, t),
              duration: formatDuration(seconds),
            })
          : t('dashboard.activities.several', {
              count: list.length,
              duration: formatDuration(seconds),
            })}
      </OverviewValue>
      {withKcal.length > 0 ? (
        <OverviewNote>
          {t('dashboard.activities.kcal', {
            value: new Intl.NumberFormat(locale).format(Math.round(kcal)),
          })}
        </OverviewNote>
      ) : null}
    </OverviewCard>
  );
}
