import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ROUTES, TRAINING_LINKS } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { useTraining, useTrainingData, workoutDisplayTitle } from '@/core/training';
import { Button, ConfirmSheet, List, ListRow, Screen } from '@/ui';
import { WorkoutDetailsSheet } from '../components/WorkoutDetailsSheet';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { formatDuration, trainingTypeLabel } from '../domain/format';
import { useElapsedSeconds } from '../hooks/useElapsedSeconds';
import styles from './WorkoutScreens.module.css';

type Dialog = 'finish' | 'discard' | 'details' | null;

/**
 * The workout in progress. Every change is written to the encrypted database immediately,
 * so closing the app or a restart never loses it; this screen simply reloads it.
 */
export function ActiveWorkoutScreen() {
  const { t } = useI18n();
  const { mutate } = useTraining();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog>(null);
  const active = useTrainingData((s, profileId) => s.workouts.getActive(profileId), []);

  if (active.status === 'loading') return null;
  if (active.status === 'error') {
    return (
      <Screen title={t('training.title')} back={{ to: ROUTES.training, label: t('training.back') }}>
        <p role="alert">{t('training.errors.loadFailed')}</p>
      </Screen>
    );
  }
  const workout = active.data;
  if (!workout) return <Navigate to={ROUTES.training} replace />;

  const completedSets = workout.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length,
    0,
  );

  return (
    <Screen
      title={workoutDisplayTitle(workout) ?? trainingTypeLabel(workout.trainingType, t)}
      eyebrow={t('training.activeTitle')}
      back={{ to: ROUTES.training, label: t('training.back') }}
    >
      <Elapsed startedAt={workout.startedAt} />
      <WorkoutEditor workout={workout} />
      <List>
        <ListRow
          title={t('training.workout.details')}
          subtitle={workout.notes ?? undefined}
          onPress={() => {
            setDialog('details');
          }}
        />
      </List>
      <div className={styles.actions}>
        <Button
          fullWidth
          onClick={() => {
            setDialog('finish');
          }}
        >
          {t('training.workout.finish')}
        </Button>
        <Button
          fullWidth
          variant="destructive"
          onClick={() => {
            setDialog('discard');
          }}
        >
          {t('training.workout.discard')}
        </Button>
      </div>

      {dialog === 'finish' ? (
        <ConfirmSheet
          title={t('training.workout.confirmFinishTitle')}
          body={t('training.workout.confirmFinishBody', { sets: completedSets })}
          confirmLabel={t('training.workout.finish')}
          cancelLabel={t('common.cancel')}
          closeLabel={t('common.close')}
          errorText={t('training.errors.saveFailed')}
          onConfirm={async () => {
            await mutate((s, profileId) => s.workouts.finish(profileId, workout.id));
            await navigate(TRAINING_LINKS.workout(workout.id), { replace: true });
          }}
          onClose={() => {
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === 'discard' ? (
        <ConfirmSheet
          title={t('training.workout.confirmDiscardTitle')}
          body={t('training.workout.confirmDiscardBody')}
          confirmLabel={t('training.workout.discard')}
          cancelLabel={t('common.cancel')}
          closeLabel={t('common.close')}
          errorText={t('training.errors.saveFailed')}
          destructive
          onConfirm={async () => {
            await mutate((s, profileId) => s.workouts.discard(profileId, workout.id));
            await navigate(ROUTES.training, { replace: true });
          }}
          onClose={() => {
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === 'details' ? (
        <WorkoutDetailsSheet
          workout={workout}
          onClose={() => {
            setDialog(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

function Elapsed({ startedAt }: { startedAt: string }) {
  const { t } = useI18n();
  const seconds = useElapsedSeconds(startedAt);
  return (
    <p className={styles.elapsed}>
      {t('training.activeSince', { duration: formatDuration(seconds) })}
    </p>
  );
}
