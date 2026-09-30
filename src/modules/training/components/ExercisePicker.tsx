import { useId, useState } from 'react';
import { useI18n } from '@/core/i18n';
import {
  exerciseDisplayName,
  matchesExerciseSearch,
  useTrainingData,
  type Exercise,
} from '@/core/training';
import { List, ListRow, Sheet } from '@/ui';
import { ExerciseFormSheet } from './ExerciseFormSheet';
import styles from './ExercisePicker.module.css';

interface ExercisePickerProps {
  onPick: (exercise: Exercise) => Promise<void>;
  onClose: () => void;
}

/** Search the active exercises (both languages) or create a custom one on the spot. */
export function ExercisePicker({ onPick, onClose }: ExercisePickerProps) {
  const { t, locale } = useI18n();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const exercises = useTrainingData((s, profileId) => s.exercises.list(profileId), []);

  if (creating) {
    return (
      <ExerciseFormSheet
        initialName={query}
        onSaved={async (exercise) => {
          await onPick(exercise);
        }}
        onClose={() => {
          setCreating(false);
        }}
      />
    );
  }

  const matches =
    exercises.status === 'ready'
      ? exercises.data
          .filter((exercise) => matchesExerciseSearch(exercise, query))
          .sort((a, b) =>
            exerciseDisplayName(a, locale).localeCompare(exerciseDisplayName(b, locale), locale),
          )
      : [];

  return (
    <Sheet title={t('training.exercises.pick')} onClose={onClose} closeLabel={t('common.close')}>
      <label htmlFor={searchId} className="visually-hidden">
        {t('training.exercises.search')}
      </label>
      <input
        id={searchId}
        className={styles.search}
        type="search"
        value={query}
        placeholder={t('training.exercises.searchPlaceholder')}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      <List label={t('training.exercises.title')}>
        <ListRow
          title={t('training.exercises.create')}
          action
          onPress={() => {
            setCreating(true);
          }}
        />
        {matches.map((exercise) => (
          <ListRow
            key={exercise.id}
            title={exerciseDisplayName(exercise, locale)}
            subtitle={t(`training.equipment.${exercise.equipment}`)}
            disabled={busy}
            onPress={() => {
              setBusy(true);
              void onPick(exercise).finally(() => {
                setBusy(false);
              });
            }}
          />
        ))}
      </List>
      {exercises.status === 'ready' && matches.length === 0 ? (
        <p className={styles.empty}>{t('training.exercises.noResults')}</p>
      ) : null}
    </Sheet>
  );
}
