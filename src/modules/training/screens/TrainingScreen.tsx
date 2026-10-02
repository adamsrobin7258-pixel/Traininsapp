import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CONTENT_LINKS, TRAINING_LINKS } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { useTraining, useTrainingData, workoutDisplayTitle } from '@/core/training';
import { Button, List, ListRow, Screen, Section } from '@/ui';
import { StartWorkoutSheet } from '../components/StartWorkoutSheet';
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
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overview = useTrainingData(
    async (s, profileId) => ({
      active: await s.workouts.getActive(profileId),
      next: await s.plans.nextWorkout(profileId),
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
                {t('training.startDay')}
              </Button>
            </div>
          ) : null}
          <Button
            fullWidth
            variant={data.next ? 'secondary' : 'primary'}
            onClick={() => {
              setError(null);
              setStarting(true);
            }}
          >
            {t('training.start')}
          </Button>
          {error && !starting ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      <Section>
        <List>
          <ListRow
            title={t('activities.title')}
            subtitle={t('activities.linkHint')}
            to={TRAINING_LINKS.activities}
          />
        </List>
      </Section>

      <Section title={t('training.historyTitle')}>
        <WorkoutHistory />
      </Section>

      {starting ? (
        <StartWorkoutSheet
          error={error}
          onStart={start}
          onOpenPlans={() => void navigate(CONTENT_LINKS.plans)}
          onClose={() => {
            setStarting(false);
            setError(null);
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
