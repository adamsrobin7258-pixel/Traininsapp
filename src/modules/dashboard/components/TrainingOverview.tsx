import { ROUTES, TRAINING_LINKS } from '@/app/routes';
import { useI18n, type TranslationKey } from '@/core/i18n';
import { getTrainingType, useTrainingData, workoutDisplayTitle } from '@/core/training';
import { List, ListRow, Section } from '@/ui';

/**
 * Workout in progress or the next planned day. Renders nothing when neither exists –
 * the Today screen never shows invented suggestions.
 */
export function TrainingOverview() {
  const { t } = useI18n();
  const state = useTrainingData(
    async (s, profileId) => ({
      active: await s.workouts.getActive(profileId),
      next: await s.plans.nextWorkout(profileId),
    }),
    [],
  );
  if (state.status !== 'ready') return null;
  const { active, next } = state.data;
  if (!active && !next) return null;

  return (
    <Section title={t('dashboard.trainingTitle')}>
      <List>
        {active ? (
          <ListRow
            icon="training"
            title={t('dashboard.activeWorkout')}
            subtitle={
              workoutDisplayTitle(active) ??
              t(`training.types.${getTrainingType(active.trainingType).id}` as TranslationKey)
            }
            value={t('training.resume')}
            to={TRAINING_LINKS.activeWorkout}
          />
        ) : next ? (
          <ListRow
            icon="training"
            title={t('dashboard.nextWorkout')}
            subtitle={t('training.nextFromPlan', { day: next.dayName, plan: next.planName })}
            to={ROUTES.training}
          />
        ) : null}
      </List>
    </Section>
  );
}
