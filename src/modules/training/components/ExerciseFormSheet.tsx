import { useId, useState, type SyntheticEvent } from 'react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import {
  EQUIPMENT,
  EXERCISE_NAME_MAX_LENGTH,
  EXERCISE_TYPES,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  useTraining,
  type Equipment,
  type Exercise,
  type ExerciseType,
  type MovementPattern,
  type MuscleGroup,
} from '@/core/training';
import { AUTOFOCUS, Button, Sheet } from '@/ui';
import { describeTrainingError } from '../domain/errors';
import styles from './ExerciseFormSheet.module.css';

interface ExerciseFormSheetProps {
  /** Edit an existing user exercise; omit to create one. */
  exercise?: Exercise;
  initialName?: string;
  onSaved: (exercise: Exercise) => Promise<void>;
  onClose: () => void;
}

/** Deactivating hides the exercise from pickers; history keeps its snapshot. */
function ActiveToggle({ exercise, onDone }: { exercise: Exercise; onDone: () => void }) {
  const { t } = useI18n();
  const { mutate } = useTraining();
  const [failed, setFailed] = useState(false);
  return (
    <>
      <Button
        variant={exercise.active ? 'destructive' : 'secondary'}
        fullWidth
        onClick={() => {
          mutate((s, profileId) =>
            s.exercises.setActive(profileId, exercise.id, !exercise.active),
          ).then(onDone, () => {
            setFailed(true);
          });
        }}
      >
        {exercise.active ? t('training.exercises.deactivate') : t('training.exercises.activate')}
      </Button>
      {failed ? (
        <p className={styles.error} role="alert">
          {t('training.errors.saveFailed')}
        </p>
      ) : null}
    </>
  );
}

/** Create or edit a custom exercise. Names are stored as typed, never translated. */
export function ExerciseFormSheet({
  exercise,
  initialName = '',
  onSaved,
  onClose,
}: ExerciseFormSheetProps) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const { mutate } = useTraining();
  const ids = { name: useId(), type: useId(), equipment: useId(), pattern: useId() };
  const [name, setName] = useState(exercise?.nameDe ?? initialName);
  const [exerciseType, setExerciseType] = useState<ExerciseType>(
    exercise?.exerciseType ?? 'weighted',
  );
  const [equipment, setEquipment] = useState<Equipment>(exercise?.equipment ?? 'barbell');
  const [pattern, setPattern] = useState<MovementPattern>(exercise?.movementPattern ?? 'other');
  const [muscles, setMuscles] = useState<MuscleGroup[]>(exercise?.primaryMuscles ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    setBusy(true);
    const input = {
      name,
      exerciseType,
      equipment,
      movementPattern: pattern,
      primaryMuscles: muscles,
    };
    try {
      const saved = await mutate((s, profileId) =>
        exercise
          ? s.exercises.update(profileId, exercise.id, input)
          : s.exercises.create(profileId, input),
      );
      await onSaved(saved);
    } catch (failure) {
      setError(describeTrainingError(failure, t, unit, locale));
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={exercise ? t('training.exercises.edit') : t('training.exercises.create')}
      onClose={onClose}
      closeLabel={t('common.close')}
    >
      <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
        <label htmlFor={ids.name} className={styles.label}>
          {t('training.exercises.nameLabel')}
        </label>
        <input
          {...(exercise ? {} : AUTOFOCUS)}
          id={ids.name}
          className={styles.field}
          value={name}
          maxLength={EXERCISE_NAME_MAX_LENGTH}
          autoComplete="off"
          aria-invalid={error !== null}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
        <label htmlFor={ids.type} className={styles.label}>
          {t('training.exercises.typeLabel')}
        </label>
        <select
          id={ids.type}
          className={styles.field}
          value={exerciseType}
          onChange={(event) => {
            setExerciseType(event.target.value as ExerciseType);
          }}
        >
          {EXERCISE_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`training.exerciseTypes.${value}`)}
            </option>
          ))}
        </select>
        <label htmlFor={ids.equipment} className={styles.label}>
          {t('training.exercises.equipmentLabel')}
        </label>
        <select
          id={ids.equipment}
          className={styles.field}
          value={equipment}
          onChange={(event) => {
            setEquipment(event.target.value as Equipment);
          }}
        >
          {EQUIPMENT.map((value) => (
            <option key={value} value={value}>
              {t(`training.equipment.${value}`)}
            </option>
          ))}
        </select>
        <label htmlFor={ids.pattern} className={styles.label}>
          {t('training.exercises.patternLabel')}
        </label>
        <select
          id={ids.pattern}
          className={styles.field}
          value={pattern}
          onChange={(event) => {
            setPattern(event.target.value as MovementPattern);
          }}
        >
          {MOVEMENT_PATTERNS.map((value) => (
            <option key={value} value={value}>
              {t(`training.patterns.${value}`)}
            </option>
          ))}
        </select>
        <fieldset className={styles.muscles}>
          <legend className={styles.label}>{t('training.exercises.musclesLabel')}</legend>
          {MUSCLE_GROUPS.map((muscle) => {
            const selected = muscles.includes(muscle);
            return (
              <button
                key={muscle}
                type="button"
                className={styles.chip}
                aria-pressed={selected}
                onClick={() => {
                  setMuscles((current) =>
                    selected ? current.filter((m) => m !== muscle) : [...current, muscle],
                  );
                }}
              >
                {t(`training.muscles.${muscle}`)}
              </button>
            );
          })}
        </fieldset>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {t('common.save')}
          </Button>
        </div>
        {exercise ? <ActiveToggle exercise={exercise} onDone={onClose} /> : null}
      </form>
    </Sheet>
  );
}
