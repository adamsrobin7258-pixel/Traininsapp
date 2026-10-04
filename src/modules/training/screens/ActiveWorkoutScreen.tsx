import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ROUTES, TRAINING_LINKS } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { useTraining, useTrainingData, workoutDisplayTitle } from '@/core/training';
import { Button, ConfirmSheet, Icon, Screen, Sheet } from '@/ui';
import { RestTimerProvider } from '../components/RestTimer';
import { WorkoutDetailsSheet } from '../components/WorkoutDetailsSheet';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { formatDuration, trainingTypeLabel } from '../domain/format';
import { useElapsedSeconds } from '../hooks/useElapsedSeconds';
import styles from './WorkoutScreens.module.css';

type Dialog = 'finish' | 'more' | 'discard' | 'details' | null;

/**
 * The workout in progress. Every change is written to the encrypted database immediately,
 * so closing the app or a restart never loses it; this screen simply reloads it.
 *
 * Its own mode: no tab bar (AppLayout), "Training beenden" as the one primary action in the
 * header, and the rare actions – title and notes, discarding – behind "Mehr", discarding only
 * after a confirmation.
 */
export function ActiveWorkoutScreen() {
  const { t } = useI18n();
  const { mutate } = useTraining();
  const { restTimerSeconds } = useSettings().settings;
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog>(null);
  // The workout being finished: finishing reloads the active workout, which can arrive before
  // the navigation below – then it is gone and this screen must still lead to its summary.
  const [finishing, setFinishing] = useState<string | null>(null);
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
  if (!workout) {
    return finishing ? (
      <Navigate to={TRAINING_LINKS.workout(finishing)} replace state={{ summary: true }} />
    ) : (
      <Navigate to={ROUTES.training} replace />
    );
  }

  const completedSets = workout.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length,
    0,
  );

  return (
    <Screen
      title={workoutDisplayTitle(workout) ?? trainingTypeLabel(workout.trainingType, t)}
      eyebrow={t('training.activeTitle')}
      back={{ to: ROUTES.training, label: t('training.back') }}
      action={
        <div className={styles.headerActions}>
          <Button
            className={styles.finish}
            onClick={() => {
              setDialog('finish');
            }}
          >
            {t('training.workout.finish')}
          </Button>
          <button
            type="button"
            className={styles.more}
            aria-label={t('training.workout.more')}
            onClick={() => {
              setDialog('more');
            }}
          >
            <Icon name="more" size={22} />
          </button>
        </div>
      }
    >
      <Elapsed startedAt={workout.startedAt} />
      <RestTimerProvider seconds={restTimerSeconds}>
        <WorkoutEditor workout={workout} />
      </RestTimerProvider>
      {dialog === 'finish' ? (
        <ConfirmSheet
          title={t('training.workout.confirmFinishTitle')}
          body={t('training.workout.confirmFinishBody', { sets: completedSets })}
          confirmLabel={t('training.workout.finish')}
          cancelLabel={t('common.cancel')}
          closeLabel={t('common.close')}
          errorText={t('training.errors.saveFailed')}
          onConfirm={async () => {
            setFinishing(workout.id);
            try {
              await mutate((s, profileId) => s.workouts.finish(profileId, workout.id));
            } catch (error) {
              setFinishing(null);
              throw error;
            }
            // The finished workout opens with its summary; back leads to Training.
            await navigate(TRAINING_LINKS.workout(workout.id), {
              replace: true,
              state: { summary: true },
            });
          }}
          onClose={() => {
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === 'more' ? (
        <Sheet
          title={t('training.workout.more')}
          onClose={() => {
            setDialog(null);
          }}
          closeLabel={t('common.close')}
        >
          <div className={styles.sheetActions}>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setDialog('details');
              }}
            >
              {t('training.workout.details')}
            </Button>
            <Button
              variant="destructive"
              fullWidth
              onClick={() => {
                setDialog('discard');
              }}
            >
              {t('training.workout.discard')}
            </Button>
          </div>
        </Sheet>
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
