import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { EMPTY_SET_VALUES, useTrainingData, type PerformanceSet } from '@/core/training';
import { parseLocalDateKey } from '@/shared/lib/date';
import { formatMediumDate } from '@/shared/lib/format';
import { fromKg } from '@/shared/lib/units';
import { formatSetShort } from '../domain/format';
import styles from './ExercisePicker.module.css';

/**
 * Best and latest performance of a weighted exercise with its direction – the few figures that
 * answer "how strong am I and is it going up?". Everything comes from `exerciseProgress`
 * (core/training/metrics.ts); nothing is shown before the first rateable workout.
 */
export function ExercisePerformance({ exerciseId }: { exerciseId: string }) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const data = useTrainingData(
    (s, profileId) => s.workouts.exerciseProgress(profileId, exerciseId),
    [exerciseId],
  );
  const progress = data.status === 'ready' ? data.data : null;
  if (!progress?.best || !progress.latest) return null;

  const line = (set: PerformanceSet) =>
    formatSetShort(
      { ...EMPTY_SET_VALUES, weightKg: set.weightKg, reps: set.reps },
      'weighted',
      unit,
      locale,
    );
  const estimate = (set: PerformanceSet) => {
    const day = parseLocalDateKey(set.localDate);
    return t('training.exercises.performance.estimate', {
      // An estimate: whole kilograms (pounds), no false precision.
      value: `${new Intl.NumberFormat(locale).format(Math.round(fromKg(set.estimatedOneRepMaxKg, unit)))} ${unit}`,
      date: day ? formatMediumDate(day, locale) : set.localDate,
    });
  };
  const trend = progress.latestIsBest ? 'best' : progress.trend;

  return (
    <section aria-label={t('training.exercises.performance.title')}>
      <h4 className={styles.listTitle}>{t('training.exercises.performance.title')}</h4>
      <dl className={styles.facts}>
        <dt>{t('training.exercises.performance.best')}</dt>
        <dd>
          <strong>{line(progress.best)}</strong>
          <br />
          {estimate(progress.best)}
        </dd>
        {progress.sessions > 1 ? (
          <>
            <dt>{t('training.exercises.performance.latest')}</dt>
            <dd>
              <strong>{line(progress.latest)}</strong>
              <br />
              {estimate(progress.latest)}
              {trend ? (
                <>
                  <br />
                  {t(`training.exercises.performance.trend.${trend}`)}
                </>
              ) : null}
            </dd>
          </>
        ) : null}
      </dl>
      <p className={styles.hint}>{t('training.exercises.performance.note')}</p>
    </section>
  );
}
