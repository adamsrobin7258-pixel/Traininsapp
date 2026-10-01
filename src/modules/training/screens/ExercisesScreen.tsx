import { useId, useMemo, useState } from 'react';
import { ROUTES } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import {
  exerciseDisplayName,
  searchExercises,
  type Equipment,
  type Exercise,
  type MuscleFilter,
} from '@/core/training';
import { List, ListRow, Screen, Section } from '@/ui';
import { ExerciseDetailSheet } from '../components/ExerciseDetailSheet';
import { ExerciseFilters } from '../components/ExerciseFilters';
import { ExerciseFormSheet } from '../components/ExerciseFormSheet';
import { ExerciseRow } from '../components/ExerciseRow';
import styles from '../components/ExercisePicker.module.css';
import { useExerciseLibrary } from '../hooks/useExerciseLibrary';

/**
 * Custom exercises (create, edit, (de)activate) and the read-only exercise library with
 * search, filters, details and favourites.
 */
export function ExercisesScreen() {
  const { t, locale } = useI18n();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleFilter | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);
  const [viewing, setViewing] = useState<Exercise | null>(null);
  const library = useExerciseLibrary({ includeInactive: true });
  const ready = library.status === 'ready' ? library.data : null;

  const matches = useMemo(
    () => (ready ? searchExercises(ready.index, { query, muscle, equipment }) : []),
    [ready, query, muscle, equipment],
  );
  const own = matches.filter((exercise) => exercise.source === 'user');
  const system = matches.filter((exercise) => exercise.source === 'system' && exercise.active);
  const filtering = query.trim() !== '' || muscle !== null || equipment !== null;

  return (
    <Screen
      title={t('training.exercises.title')}
      back={{ to: ROUTES.training, label: t('training.back') }}
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
      {library.status === 'error' ? <p role="alert">{t('training.errors.loadFailed')}</p> : null}

      <Section title={t('training.exercises.own')} footer={t('training.exercises.deactivateHint')}>
        <List label={t('training.exercises.own')}>
          {own.map((exercise) => (
            <ListRow
              key={exercise.id}
              title={exerciseDisplayName(exercise, locale)}
              subtitle={
                exercise.active
                  ? t(`training.exerciseTypes.${exercise.exerciseType}`)
                  : t('training.exercises.inactive')
              }
              onPress={() => {
                setEditing(exercise);
              }}
            />
          ))}
          {ready && own.length === 0 && !filtering ? (
            <ListRow title={t('training.exercises.ownEmpty')} />
          ) : null}
          <ListRow
            title={t('training.exercises.create')}
            action
            onPress={() => {
              setEditing('new');
            }}
          />
        </List>
      </Section>

      <Section title={t('training.exercises.system')}>
        {ready ? (
          <p className={styles.count}>
            {t('training.exercises.resultCount', { count: system.length })}
          </p>
        ) : null}
        <List label={t('training.exercises.system')}>
          {system.map((exercise) => (
            <ExerciseRow
              key={exercise.id}
              exercise={exercise}
              favorite={ready?.favoriteIds.has(exercise.id) ?? false}
              onPress={() => {
                setViewing(exercise);
              }}
            />
          ))}
        </List>
        {ready && system.length === 0 ? (
          <p className={styles.empty}>{t('training.exercises.noResults')}</p>
        ) : null}
      </Section>

      {viewing ? (
        <ExerciseDetailSheet
          exercise={viewing}
          favorite={ready?.favoriteIds.has(viewing.id) ?? false}
          onClose={() => {
            setViewing(null);
          }}
        />
      ) : null}
      {editing ? (
        <ExerciseFormSheet
          exercise={editing === 'new' ? undefined : editing}
          onSaved={() => {
            setEditing(null);
            return Promise.resolve();
          }}
          onClose={() => {
            setEditing(null);
          }}
        />
      ) : null}
    </Screen>
  );
}
