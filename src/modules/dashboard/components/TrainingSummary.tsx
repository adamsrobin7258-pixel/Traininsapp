import { ROUTES } from '@/app/routes';
import { useI18n, type TranslationKey } from '@/core/i18n';
import { getTrainingType, useTrainingData, workoutDisplayTitle } from '@/core/training';
import { toLocalDateKey } from '@/shared/lib/date';
import { formatDuration, formatRelativeDay } from '@/shared/lib/format';
import { OverviewCard, OverviewLine, OverviewStat, OverviewStats } from './OverviewCard';

/** Training at a glance: active or last workout, the next planned day and recent frequency. */
export function TrainingSummary({ now }: { now: Date }) {
  const { t, locale } = useI18n();
  const data = useTrainingData(
    async (s, profileId) => ({
      active: await s.workouts.getActive(profileId),
      next: await s.plans.nextWorkout(profileId),
      overview: await s.workouts.overview(profileId),
    }),
    [],
  );
  const typeLabel = (id: string) => t(`training.types.${getTrainingType(id).id}` as TranslationKey);

  return (
    <OverviewCard icon="training" title={t('dashboard.training.title')} to={ROUTES.training}>
      {data.status === 'error' ? <span role="alert">{t('training.errors.loadFailed')}</span> : null}
      {data.status === 'ready' ? (
        <>
          {data.data.active ? (
            <OverviewLine label={t('dashboard.training.active')}>
              {t('dashboard.training.activeSince', {
                title:
                  workoutDisplayTitle(data.data.active) ?? typeLabel(data.data.active.trainingType),
                duration: formatDuration(
                  (now.getTime() - new Date(data.data.active.startedAt).getTime()) / 1000,
                ),
              })}
            </OverviewLine>
          ) : null}
          <OverviewLine label={t('dashboard.training.last')}>
            {data.data.overview.last
              ? [
                  data.data.overview.last.title ??
                    data.data.overview.last.planDayName ??
                    typeLabel(data.data.overview.last.trainingType),
                  formatRelativeDay(
                    data.data.overview.last.localDate,
                    toLocalDateKey(now),
                    locale,
                    {
                      today: t('training.today'),
                      yesterday: t('training.yesterday'),
                    },
                  ),
                  data.data.overview.last.durationS !== null
                    ? formatDuration(data.data.overview.last.durationS)
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : t('dashboard.training.lastNone')}
          </OverviewLine>
          <OverviewLine label={t('dashboard.training.next')}>
            {data.data.next
              ? t('training.nextFromPlan', {
                  day: data.data.next.dayName,
                  plan: data.data.next.planName,
                })
              : t('dashboard.training.nextNone')}
          </OverviewLine>
          <OverviewStats>
            <OverviewStat
              value={data.data.overview.last7Days}
              label={t('dashboard.training.last7')}
            />
            <OverviewStat
              value={data.data.overview.last30Days}
              label={t('dashboard.training.last30')}
            />
          </OverviewStats>
        </>
      ) : null}
    </OverviewCard>
  );
}
