import { useState } from 'react';
import { useI18n } from '@/core/i18n';
import {
  exerciseDisplayName,
  highlightGroups,
  muscleHighlight,
  useTraining,
  type Exercise,
} from '@/core/training';
import { Icon, Sheet } from '@/ui';
import { MuscleMapPreview, MuscleMapSheet } from '../muscleMap/MuscleMap';
import { ExercisePerformance } from './ExercisePerformance';
import styles from './ExercisePicker.module.css';

/**
 * Read-only details of an exercise with a favourite toggle and, for weighted exercises, the
 * user's best and latest performance. Below the facts the muscle map shows the exercise's primary
 * and secondary muscles (front and back); tapping it swaps these details for the large map, and
 * closing that returns here.
 */
export function ExerciseDetailSheet({
  exercise,
  favorite: initialFavorite,
  onClose,
}: {
  exercise: Exercise;
  favorite: boolean;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { mutate } = useTraining();
  const [favorite, setFavorite] = useState(initialFavorite);
  const [failed, setFailed] = useState(false);
  const description = locale === 'de' ? exercise.instructionsDe : exercise.instructionsEn;
  const muscles = (list: Exercise['primaryMuscles']) =>
    list.map((muscle) => t(`training.muscles.${muscle}`)).join(', ');
  const highlight = muscleHighlight(exercise);
  const groups = highlightGroups(highlight);
  const hasMap = groups.primary.length + groups.secondary.length > 0;
  const [mapOpen, setMapOpen] = useState(false);

  if (hasMap && mapOpen) {
    return (
      <MuscleMapSheet
        title={exerciseDisplayName(exercise, locale)}
        highlight={highlight}
        onClose={() => {
          setMapOpen(false);
        }}
      />
    );
  }

  return (
    <Sheet title={t('training.exercises.details')} onClose={onClose} closeLabel={t('common.close')}>
      <div className={styles.detailHead}>
        <h3 className={styles.detailName}>{exerciseDisplayName(exercise, locale)}</h3>
        <button
          type="button"
          className={styles.favorite}
          aria-pressed={favorite}
          aria-label={
            favorite ? t('training.exercises.removeFavorite') : t('training.exercises.addFavorite')
          }
          onClick={() => {
            const next = !favorite;
            setFavorite(next);
            setFailed(false);
            mutate((s, profileId) => s.exercises.setFavorite(profileId, exercise.id, next)).catch(
              () => {
                setFavorite(!next);
                setFailed(true);
              },
            );
          }}
        >
          <Icon name="star" size={22} />
        </button>
      </div>
      {failed ? <p role="alert">{t('training.errors.saveFailed')}</p> : null}
      <dl className={styles.facts}>
        <dt>{t('training.exercises.primaryMuscles')}</dt>
        <dd>{muscles(exercise.primaryMuscles)}</dd>
        {exercise.secondaryMuscles.length > 0 ? (
          <>
            <dt>{t('training.exercises.secondaryMuscles')}</dt>
            <dd>{muscles(exercise.secondaryMuscles)}</dd>
          </>
        ) : null}
        <dt>{t('training.exercises.equipment')}</dt>
        <dd>{t(`training.equipment.${exercise.equipment}`)}</dd>
        <dt>{t('training.exercises.pattern')}</dt>
        <dd>{t(`training.patterns.${exercise.movementPattern}`)}</dd>
        <dt>{t('training.exercises.tracking')}</dt>
        <dd>{t(`training.exerciseTypes.${exercise.exerciseType}`)}</dd>
      </dl>
      {hasMap ? (
        <section aria-label={t('training.muscleMap.title')}>
          <h4 className={styles.listTitle}>{t('training.muscleMap.title')}</h4>
          <MuscleMapPreview
            highlight={highlight}
            onOpen={() => {
              setMapOpen(true);
            }}
          />
        </section>
      ) : null}
      {exercise.exerciseType === 'weighted' ? (
        <ExercisePerformance exerciseId={exercise.id} />
      ) : null}
      {description ? (
        <section aria-label={t('training.exercises.description')}>
          <h4 className={styles.listTitle}>{t('training.exercises.description')}</h4>
          <p className={styles.description}>{description}</p>
        </section>
      ) : null}
      {exercise.source === 'system' ? (
        <p className={styles.hint}>{t('training.exercises.systemHint')}</p>
      ) : null}
    </Sheet>
  );
}
