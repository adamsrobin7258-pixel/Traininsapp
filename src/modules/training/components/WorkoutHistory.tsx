import { useState } from 'react';
import { TRAINING_LINKS } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { useTrainingData, workoutDisplayTitle } from '@/core/training';
import { toLocalDateKey } from '@/shared/lib/date';
import { List, ListRow } from '@/ui';
import { formatDuration, relativeDay, trainingTypeLabel } from '../domain/format';

const PAGE_SIZE = 10;

/** Completed workouts, newest first, loaded page by page. */
export function WorkoutHistory() {
  const { t, locale } = useI18n();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const page = useTrainingData(
    async (s, profileId) => ({
      items: await s.workouts.getHistory(profileId, { limit }),
      total: await s.workouts.countHistory(profileId),
    }),
    [limit],
  );
  const today = toLocalDateKey(new Date());

  if (page.status === 'error') return <p role="alert">{t('training.errors.loadFailed')}</p>;
  if (page.status === 'loading') return null;
  if (page.data.items.length === 0) {
    return (
      <List>
        <ListRow title={t('training.historyEmpty')} />
      </List>
    );
  }

  return (
    <List label={t('training.historyTitle')}>
      {page.data.items.map((workout) => {
        const details = [
          relativeDay(workout.localDate, today, locale, t),
          workout.durationS !== null ? formatDuration(workout.durationS) : null,
          workout.exerciseCount === 1
            ? t('training.exerciseCountOne')
            : t('training.exerciseCount', { count: workout.exerciseCount }),
        ].filter(Boolean);
        return (
          <ListRow
            key={workout.id}
            icon="training"
            title={workoutDisplayTitle(workout) ?? trainingTypeLabel(workout.trainingType, t)}
            subtitle={details.join(' · ')}
            to={TRAINING_LINKS.workout(workout.id)}
          />
        );
      })}
      {page.data.total > page.data.items.length ? (
        <ListRow
          title={t('training.showMore')}
          action
          onPress={() => {
            setLimit((value) => value + PAGE_SIZE);
          }}
        />
      ) : null}
    </List>
  );
}
