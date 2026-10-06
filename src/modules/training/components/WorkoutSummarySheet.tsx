import { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import {
  aggregateMuscleHighlight,
  REST_VISUAL,
  doneExercises,
  exerciseDisplayName,
  highlightGroups,
  totalVolumeKg,
  useTrainingData,
  workoutDisplayTitle,
  type WorkoutDetail,
  type WorkoutSet,
} from '@/core/training';
import { Button, Sheet, Stat } from '@/ui';
import { MuscleFigurePreview, MuscleFigureSheet } from '../figure/MuscleFigure';
import { useMuscleText } from '../figure/useMuscleText';
import { formatDuration, formatLoad, formatSetShort, trainingTypeLabel } from '../domain/format';
import styles from './WorkoutSummarySheet.module.css';

/** The best working set of an exercise: heaviest, then most reps. */
function bestSet(sets: readonly WorkoutSet[]): WorkoutSet | null {
  let best: WorkoutSet | null = null;
  for (const set of sets) {
    if (!set.completed || set.setType !== 'working' || set.weightKg === null) continue;
    if (
      !best ||
      set.weightKg > (best.weightKg ?? 0) ||
      (set.weightKg === best.weightKg && (set.reps ?? 0) > (best.reps ?? 0))
    ) {
      best = set;
    }
  }
  return best;
}

/**
 * Shown once right after finishing: name, duration, exercises, completed sets, volume, a short
 * line per exercise and new heaviest weights (only against earlier workouts with data – the
 * first time is no record). Close leads to Training, "Training ansehen" to the full workout.
 * "Beanspruchte Muskeln" pictures the muscle groups of the exercises actually done (at least one
 * completed set) – a union of their catalog muscles, no score.
 */
export function WorkoutSummarySheet({
  workout,
  onClose,
  onView,
}: {
  workout: WorkoutDetail;
  onClose: () => void;
  onView: () => void;
}) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const records = useTrainingData(
    (s, profileId) => s.workouts.records(profileId, workout.id),
    [workout.id],
  );
  const completed = workout.exercises.flatMap((e) => e.sets).filter((set) => set.completed);
  const workingCount = completed.filter((set) => set.setType === 'working').length;
  const volume = totalVolumeKg(completed);
  const name = workoutDisplayTitle(workout) ?? trainingTypeLabel(workout.trainingType, t);
  const recordList = records.status === 'ready' ? records.data : [];
  const doneIds = [
    ...new Set(
      workout.exercises.flatMap((e) =>
        e.exerciseId !== null && e.sets.some((set) => set.completed) ? [e.exerciseId] : [],
      ),
    ),
  ];
  const catalog = useTrainingData(
    async (s) =>
      (await Promise.all(doneIds.map((id) => s.exercises.get(id)))).flatMap((e) => (e ? [e] : [])),
    [doneIds.join(',')],
  );
  const highlight =
    catalog.status === 'ready'
      ? aggregateMuscleHighlight(
          doneExercises(workout, (id) => catalog.data.find((exercise) => exercise.id === id)),
        )
      : {};
  const worked = highlightGroups(highlight);
  const muscleText = useMuscleText(highlight);
  const [figureOpen, setFigureOpen] = useState(false);

  if (figureOpen) {
    return (
      <MuscleFigureSheet
        title={t('training.figure.summaryTitle')}
        clip={REST_VISUAL.clip}
        highlight={highlight}
        onClose={() => {
          setFigureOpen(false);
        }}
      />
    );
  }
  const sets = (count: number) =>
    count === 1 ? t('training.summary.setsOne') : t('training.summary.sets', { count });

  return (
    <Sheet title={t('training.summary.title')} onClose={onView} closeLabel={t('common.close')}>
      <div className={styles.summary}>
        <h3 className={styles.name}>{name}</h3>
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
            value={String(workingCount)}
            emptyLabel={t('common.noValue')}
          />
          <Stat
            label={t('training.detail.volume')}
            value={volume > 0 ? formatLoad(volume, unit, locale) : null}
            emptyLabel={t('common.noValue')}
          />
        </div>

        {worked.primary.length + worked.secondary.length > 0 ? (
          <section aria-label={t('training.figure.summaryTitle')}>
            <h4 className={styles.heading}>{t('training.figure.summaryTitle')}</h4>
            <div className={styles.muscles}>
              <MuscleFigurePreview
                clip={REST_VISUAL.clip}
                highlight={highlight}
                pair
                onOpen={() => {
                  setFigureOpen(true);
                }}
              />
              <dl className={styles.muscleList}>
                <dt>{t('training.figure.primary')}</dt>
                <dd>{muscleText.primary || '–'}</dd>
                {muscleText.secondary !== '' ? (
                  <>
                    <dt>{t('training.figure.secondary')}</dt>
                    <dd>{muscleText.secondary}</dd>
                  </>
                ) : null}
              </dl>
            </div>
          </section>
        ) : null}

        {recordList.length > 0 ? (
          <section aria-label={t('training.summary.recordsTitle')}>
            <h4 className={styles.heading}>{t('training.summary.recordsTitle')}</h4>
            <ul className={styles.list}>
              {recordList.map((record) => {
                const exercise = workout.exercises.find((e) => e.id === record.workoutExerciseId);
                return (
                  <li key={record.workoutExerciseId} className={styles.row}>
                    <span className={styles.rowName}>
                      {exercise ? exerciseDisplayName(exercise, locale) : ''}
                    </span>
                    <span className={styles.rowValue}>
                      {t('training.summary.record', {
                        load: formatLoad(record.weightKg, unit, locale),
                        previous: formatLoad(record.previousKg, unit, locale),
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {workout.exercises.length > 0 ? (
          <section aria-label={t('training.summary.exercisesTitle')}>
            <h4 className={styles.heading}>{t('training.summary.exercisesTitle')}</h4>
            <ul className={styles.list}>
              {workout.exercises.map((exercise) => {
                const done = exercise.sets.filter(
                  (set) => set.completed && set.setType === 'working',
                ).length;
                const best = bestSet(exercise.sets);
                return (
                  <li key={exercise.id} className={styles.row}>
                    <span className={styles.rowName}>{exerciseDisplayName(exercise, locale)}</span>
                    <span className={styles.rowValue}>
                      {best
                        ? t('training.summary.exerciseLine', {
                            sets: sets(done),
                            best: formatSetShort(best, exercise.exerciseType, unit, locale),
                          })
                        : sets(done)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className={styles.actions}>
          <Button fullWidth onClick={onClose}>
            {t('training.summary.close')}
          </Button>
          <Button fullWidth variant="secondary" onClick={onView}>
            {t('training.summary.view')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
