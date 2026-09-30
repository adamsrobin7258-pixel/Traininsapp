import { useState } from 'react';
import { useNavigate } from 'react-router';
import { TRAINING_LINKS } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import {
  PLAN_NAME_MAX_LENGTH,
  useTraining,
  useTrainingData,
  workoutDisplayTitle,
} from '@/core/training';
import { Button, List, ListRow, PromptSheet, Screen, Section } from '@/ui';
import { WorkoutHistory } from '../components/WorkoutHistory';
import { describeTrainingError } from '../domain/errors';
import { formatDuration, trainingTypeLabel } from '../domain/format';
import { useElapsedSeconds } from '../hooks/useElapsedSeconds';
import styles from './TrainingScreen.module.css';

export function TrainingScreen() {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const { mutate } = useTraining();
  const navigate = useNavigate();
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overview = useTrainingData(
    async (s, profileId) => ({
      active: await s.workouts.getActive(profileId),
      next: await s.plans.nextWorkout(profileId),
      plans: await s.plans.listPlans(profileId),
    }),
    [],
  );

  async function start(dayId: string | null) {
    setError(null);
    try {
      await mutate((s, profileId) =>
        dayId ? s.workouts.startFromPlan(profileId, dayId) : s.workouts.startFree(profileId),
      );
      await navigate(TRAINING_LINKS.activeWorkout);
    } catch (failure) {
      setError(describeTrainingError(failure, t, unit, locale));
    }
  }

  const data = overview.status === 'ready' ? overview.data : null;

  return (
    <Screen title={t('training.title')}>
      {overview.status === 'error' ? <p role="alert">{t('training.errors.loadFailed')}</p> : null}

      {data?.active ? (
        <Section title={t('training.activeTitle')}>
          <ActiveWorkoutCard
            title={
              workoutDisplayTitle(data.active) ?? trainingTypeLabel(data.active.trainingType, t)
            }
            startedAt={data.active.startedAt}
            onResume={() => void navigate(TRAINING_LINKS.activeWorkout)}
          />
        </Section>
      ) : data ? (
        <div className={styles.start}>
          {data.next ? (
            <div className={styles.next}>
              <p className={styles.nextLabel}>{t('training.nextTitle')}</p>
              <p className={styles.nextTitle}>
                {t('training.nextFromPlan', { day: data.next.dayName, plan: data.next.planName })}
              </p>
              <Button fullWidth onClick={() => void start(data.next?.dayId ?? null)}>
                {t('training.start')}
              </Button>
            </div>
          ) : null}
          <Button
            fullWidth
            variant={data.next ? 'secondary' : 'primary'}
            onClick={() => void start(null)}
          >
            {data.next ? t('training.startFree') : t('training.start')}
          </Button>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      <Section title={t('training.plansTitle')}>
        <List label={t('training.plansTitle')}>
          {data?.plans.map((plan) => (
            <ListRow key={plan.id} title={plan.name} to={TRAINING_LINKS.plan(plan.id)} />
          ))}
          {data && data.plans.length === 0 ? <ListRow title={t('training.plansEmpty')} /> : null}
          <ListRow
            title={t('training.newPlan')}
            action
            onPress={() => {
              setCreatingPlan(true);
            }}
          />
        </List>
      </Section>

      <Section title={t('training.historyTitle')}>
        <WorkoutHistory />
      </Section>

      <Section>
        <List>
          <ListRow title={t('training.manageExercises')} to={TRAINING_LINKS.exercises} />
        </List>
      </Section>

      {creatingPlan ? (
        <PromptSheet
          title={t('training.newPlan')}
          label={t('training.plan.namePrompt')}
          placeholder={t('training.plan.namePlaceholder')}
          maxLength={PLAN_NAME_MAX_LENGTH}
          confirmLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          closeLabel={t('common.close')}
          describeError={(failure) => describeTrainingError(failure, t, unit, locale)}
          onSubmit={async (name) => {
            const plan = await mutate((s, profileId) => s.plans.createPlan(profileId, name));
            await navigate(TRAINING_LINKS.plan(plan.id));
          }}
          onClose={() => {
            setCreatingPlan(false);
          }}
        />
      ) : null}
    </Screen>
  );
}

function ActiveWorkoutCard({
  title,
  startedAt,
  onResume,
}: {
  title: string;
  startedAt: string;
  onResume: () => void;
}) {
  const { t } = useI18n();
  const elapsed = useElapsedSeconds(startedAt);
  return (
    <div className={styles.next}>
      <p className={styles.nextTitle}>{title}</p>
      <p className={styles.nextLabel}>
        {t('training.activeSince', { duration: formatDuration(elapsed) })}
      </p>
      <Button fullWidth onClick={onResume}>
        {t('training.resume')}
      </Button>
    </div>
  );
}
