import { useId, useMemo, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { searchExercises, type Equipment, type Exercise, type MuscleFilter } from '@/core/training';
import { List, ListRow, Sheet } from '@/ui';
import { useExerciseLibrary } from '../hooks/useExerciseLibrary';
import { ExerciseFilters } from './ExerciseFilters';
import { ExerciseFormSheet } from './ExerciseFormSheet';
import { ExerciseRow } from './ExerciseRow';
import styles from './ExercisePicker.module.css';

interface ExercisePickerProps {
  onPick: (exercise: Exercise) => Promise<void>;
  onClose: () => void;
}

/**
 * Search and filter the active exercises (both languages, aliases) or create a custom one.
 * Without search or filter, favourites and recently used exercises come first.
 *
 * Opens without the keyboard (the search field is only focused when tapped). The sheet keeps
 * its height within the visible viewport; search and filters stay on top and only the list
 * scrolls, so every exercise stays reachable with or without the keyboard.
 */
export function ExercisePicker({ onPick, onClose }: ExercisePickerProps) {
  const { t } = useI18n();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleFilter | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const library = useExerciseLibrary();
  const ready = library.status === 'ready' ? library.data : null;

  const matches = useMemo(
    () => (ready ? searchExercises(ready.index, { query, muscle, equipment }) : []),
    [ready, query, muscle, equipment],
  );

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

  const browsing = query.trim() === '' && muscle === null && equipment === null;
  const row = (exercise: Exercise, key: string) => (
    <ExerciseRow
      key={key}
      exercise={exercise}
      favorite={ready?.favoriteIds.has(exercise.id) ?? false}
      disabled={busy}
      onPress={() => {
        setBusy(true);
        void onPick(exercise).finally(() => {
          setBusy(false);
        });
      }}
    />
  );
  const shortcut = (title: string, exercises: Exercise[], prefix: string) =>
    browsing && exercises.length > 0 ? (
      <section aria-label={title}>
        <h3 className={styles.listTitle}>{title}</h3>
        <List label={title}>
          {exercises.map((exercise) => row(exercise, prefix + exercise.id))}
        </List>
      </section>
    ) : null;
  const resultsTitle = browsing ? t('training.exercises.all') : t('training.exercises.results');

  return (
    <Sheet
      title={t('training.exercises.pick')}
      onClose={onClose}
      closeLabel={t('common.close')}
      fill
    >
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
      <ExerciseFilters
        muscle={muscle}
        equipment={equipment}
        onMuscleChange={setMuscle}
        onEquipmentChange={setEquipment}
      />
      <div className={styles.scroll} data-testid="exercise-picker-list">
        {library.status === 'error' ? <p role="alert">{t('training.errors.loadFailed')}</p> : null}
        <List label={t('training.exercises.create')}>
          <ListRow
            title={t('training.exercises.create')}
            action
            onPress={() => {
              setCreating(true);
            }}
          />
        </List>
        {ready ? shortcut(t('training.exercises.favorites'), ready.favorites, 'fav-') : null}
        {ready ? shortcut(t('training.exercises.recent'), ready.recent, 'recent-') : null}
        <section aria-label={resultsTitle}>
          <h3 className={styles.listTitle}>
            {resultsTitle}
            {ready ? (
              <span className={styles.count}>
                {t('training.exercises.resultCount', { count: matches.length })}
              </span>
            ) : null}
          </h3>
          <List label={resultsTitle}>{matches.map((exercise) => row(exercise, exercise.id))}</List>
        </section>
        {ready && matches.length === 0 ? (
          <div className={styles.empty}>
            <p>{t('training.exercises.noResults')}</p>
            {!browsing ? (
              <button
                type="button"
                className={styles.reset}
                onClick={() => {
                  setQuery('');
                  setMuscle(null);
                  setEquipment(null);
                }}
              >
                {t('training.exercises.resetFilters')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
