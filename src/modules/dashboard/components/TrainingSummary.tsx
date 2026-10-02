import { ROUTES, TRAINING_LINKS } from '@/app/routes';
import { useI18n, type TranslationKey } from '@/core/i18n';
import {
  getTrainingType,
  useTrainingData,
  workoutDisplayTitle,
  workoutProgress,
} from '@/core/training';
import { toLocalDateKey } from '@/shared/lib/date';
import { formatDuration } from '@/shared/lib/format';
import { OverviewAction, OverviewCard, OverviewLine, OverviewNote } from './OverviewCard';

/**
 * Today's training only: the workout in progress (with its next step), the workouts finished
 * today, or a calm note. Counts and history belong to "Dein Fortschritt" and the training area.
 */
export function TrainingSummary({ now }: { now: Date }) {
  const { t } = useI18n();
  const today = toLocalDateKey(now);
  const data = useTrainingData(
    async (s, profileId) => ({
      active: await s.workouts.getActive(profileId),
      next: await s.plans.nextWorkout(profileId),
      // A handful is plenty for one day; history stays in the training area.
      done: (await s.workouts.getHistory(profileId, { limit: 5 })).filter(
        (workout) => workout.localDate === today,
      ),
    }),
    [today],
  );
  const typeLabel = (id: string) => t(`training.types.${getTrainingType(id).id}` as TranslationKey);
  const ready = data.status === 'ready' ? data.data : null;
  const active = ready?.active ?? null;
  const progress = active ? workoutProgress(active) : null;

  return (
    <OverviewCard
      icon="training"
      title={t('dashboard.training.title')}
      to={active ? TRAINING_LINKS.activeWorkout : ROUTES.training}
    >
      {data.status === 'error' ? <span role="alert">{t('training.errors.loadFailed')}</span> : null}
      {active ? (
        <>
          <OverviewLine label={t('dashboard.training.active')}>
            {t('dashboard.training.activeSince', {
              title: workoutDisplayTitle(active) ?? typeLabel(active.trainingType),
              duration: formatDuration(
                (now.getTime() - new Date(active.startedAt).getTime()) / 1000,
              ),
            })}
          </OverviewLine>
          {progress && progress.total > 0 ? (
            <OverviewNote>
              {t('dashboard.training.exercisesDone', {
                done: progress.done,
                total: progress.total,
              })}
            </OverviewNote>
          ) : null}
          <OverviewAction>{t('dashboard.training.resume')}</OverviewAction>
        </>
      ) : ready && ready.done.length > 0 ? (
        <OverviewLine label={t('dashboard.training.doneToday')}>
          {ready.done
            .map((workout) =>
              workout.durationS !== null
                ? t('dashboard.training.workoutLine', {
                    title: workout.title ?? workout.planDayName ?? typeLabel(workout.trainingType),
                    duration: formatDuration(workout.durationS),
                  })
                : (workout.title ?? workout.planDayName ?? typeLabel(workout.trainingType)),
            )
            .join(', ')}
        </OverviewLine>
      ) : ready ? (
        <>
          <OverviewNote>
            {ready.next ? t('dashboard.training.notYetToday') : t('dashboard.training.noneToday')}
          </OverviewNote>
          {ready.next ? (
            <OverviewLine label={t('dashboard.training.next')}>
              {t('training.nextFromPlan', { day: ready.next.dayName, plan: ready.next.planName })}
            </OverviewLine>
          ) : null}
        </>
      ) : null}
    </OverviewCard>
  );
}
