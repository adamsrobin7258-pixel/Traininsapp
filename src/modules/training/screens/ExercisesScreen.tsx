import { useId, useState } from 'react';
import { ROUTES } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import {
  exerciseDisplayName,
  matchesExerciseSearch,
  useTrainingData,
  type Exercise,
} from '@/core/training';
import { List, ListRow, Screen, Section } from '@/ui';
import { ExerciseFormSheet } from '../components/ExerciseFormSheet';
import styles from '../components/ExercisePicker.module.css';

/** Custom exercises (create, edit, (de)activate) and the read-only exercise library. */
export function ExercisesScreen() {
  const { t, locale } = useI18n();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);
  const all = useTrainingData(
    (s, profileId) => s.exercises.list(profileId, { includeInactive: true }),
    [],
  );

  const sorted =
    all.status === 'ready'
      ? all.data
          .filter((exercise) => matchesExerciseSearch(exercise, query))
          .sort((a, b) =>
            exerciseDisplayName(a, locale).localeCompare(exerciseDisplayName(b, locale), locale),
          )
      : [];
  const own = sorted.filter((exercise) => exercise.source === 'user');
  const library = sorted.filter((exercise) => exercise.source === 'system' && exercise.active);

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
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      {all.status === 'error' ? <p role="alert">{t('training.errors.loadFailed')}</p> : null}

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
          {all.status === 'ready' && own.length === 0 ? (
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
        <List label={t('training.exercises.system')}>
          {library.map((exercise) => (
            <ListRow
              key={exercise.id}
              title={exerciseDisplayName(exercise, locale)}
              subtitle={[
                t(`training.equipment.${exercise.equipment}`),
                ...exercise.primaryMuscles.map((muscle) => t(`training.muscles.${muscle}`)),
              ].join(' · ')}
            />
          ))}
        </List>
      </Section>

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
