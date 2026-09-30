import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ROUTES } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import {
  exerciseDisplayName,
  groupSets,
  totalVolumeKg,
  TrainingError,
  useTraining,
  useTrainingData,
  workoutDisplayTitle,
  type WorkoutSet,
} from '@/core/training';
import { formatLongDate } from '@/shared/lib/format';
import { ConfirmSheet, Button, List, ListRow, Screen, Section, Stat } from '@/ui';
import { WorkoutDetailsSheet } from '../components/WorkoutDetailsSheet';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { formatDuration, formatLoad, formatSetShort, trainingTypeLabel } from '../domain/format';
import styles from './WorkoutScreens.module.css';

/** A completed workout: summary, exercises and sets; editable and deletable. */
export function WorkoutDetailScreen() {
  const { workoutId = '' } = useParams();
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const { mutate } = useTraining();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<'delete' | 'details' | null>(null);
  const detail = useTrainingData(
    (s, profileId) => s.workouts.getDetail(profileId, workoutId),
    [workoutId],
  );
  const back = { to: ROUTES.training, label: t('training.back') };

  if (detail.status === 'loading') return null;
  if (detail.status === 'error') {
    const gone = detail.error instanceof TrainingError && detail.error.code === 'not-found';
    return (
      <Screen title={t('training.title')} back={back}>
        <p role="alert">{gone ? t('training.detail.notFound') : t('training.errors.loadFailed')}</p>
      </Screen>
    );
  }

  const workout = detail.data;
  const sets = workout.exercises.flatMap((exercise) => exercise.sets);
  const completed = sets.filter((set) => set.completed);
  // Warm-ups add no volume and are not counted as sets; drops belong to their working set.
  const volume = totalVolumeKg(completed);
  const completedWorking = completed.filter((set) => set.setType === 'working');

  /** Sets in display order with their marker: warm-ups (A1), working sets (1), drops (↓). */
  const detailRows = (list: readonly WorkoutSet[]) => {
    const { warmups, working } = groupSets(list);
    return [
      ...warmups.map((set, i) => ({
        set,
        badge: t('training.workout.warmupBadge', { number: i + 1 }),
        label: t('training.workout.warmupNumber', { number: i + 1 }),
      })),
      ...working.flatMap((group, i) => [
        {
          set: group.set,
          badge: String(i + 1),
          label: t('training.workout.setNumber', { number: i + 1 }),
        },
        ...group.drops.map((set, d) => ({
          set,
          badge: t('training.workout.dropBadge'),
          label: t('training.workout.dropNumber', { number: i + 1, drop: d + 1 }),
        })),
      ]),
    ];
  };
  const started = new Date(workout.startedAt);
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    started,
  );

  return (
    <Screen
      title={workoutDisplayTitle(workout) ?? trainingTypeLabel(workout.trainingType, t)}
      eyebrow={`${formatLongDate(started, locale)} · ${time}`}
      back={back}
      action={
        <button
          type="button"
          className={styles.edit}
          aria-pressed={editing}
          onClick={() => {
            setEditing((value) => !value);
          }}
        >
          {editing ? t('training.detail.done') : t('training.detail.edit')}
        </button>
      }
    >
      <div className={styles.stats}>
        <Stat
          label={t('training.detail.duration')}
          value={workout.durationS !== null ? formatDuration(workout.durationS) : null}
          emptyLabel={t('common.noValue')}
        />
        <Stat
          label={t('training.detail.exercises')}
          value={String(workout.exercises.length)}
          emptyLabel={t('common.noValue')}
        />
        <Stat
          label={t('training.detail.sets')}
          value={String(completedWorking.length)}
          emptyLabel={t('common.noValue')}
        />
        <Stat
          label={t('training.detail.volume')}
          value={volume > 0 ? formatLoad(volume, unit, locale) : null}
          emptyLabel={t('common.noValue')}
        />
      </div>

      {workout.planName ? (
        <p className={styles.notes}>{t('training.detail.fromPlan', { plan: workout.planName })}</p>
      ) : null}

      {editing ? (
        <>
          <WorkoutEditor workout={workout} />
          <List>
            <ListRow
              title={t('training.workout.details')}
              onPress={() => {
                setDialog('details');
              }}
            />
          </List>
        </>
      ) : (
        <Section title={t('training.detail.exercises')}>
          <div className={styles.actions}>
            {workout.exercises.map((exercise) => (
              <article
                key={exercise.id}
                className={styles.exercise}
                aria-label={exerciseDisplayName(exercise, locale)}
              >
                <h3 className={styles.exerciseName}>{exerciseDisplayName(exercise, locale)}</h3>
                <ol className={styles.sets}>
                  {detailRows(exercise.sets).map(({ set, badge, label }) => (
                    <li
                      key={set.id}
                      className={styles.set}
                      data-completed={set.completed}
                      data-type={set.setType}
                    >
                      <span className={styles.setNumber} aria-label={label}>
                        {badge}
                      </span>
                      <span>{formatSetShort(set, exercise.exerciseType, unit, locale)}</span>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </Section>
      )}

      {workout.notes && !editing ? <p className={styles.notes}>{workout.notes}</p> : null}

      <Button
        variant="destructive"
        fullWidth
        onClick={() => {
          setDialog('delete');
        }}
      >
        {t('training.detail.delete')}
      </Button>

      {dialog === 'delete' ? (
        <ConfirmSheet
          title={t('training.detail.confirmDeleteTitle')}
          body={t('training.detail.confirmDeleteBody', { date: formatLongDate(started, locale) })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          closeLabel={t('common.close')}
          errorText={t('training.errors.saveFailed')}
          destructive
          onConfirm={async () => {
            await mutate((s, profileId) => s.workouts.delete(profileId, workout.id));
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
