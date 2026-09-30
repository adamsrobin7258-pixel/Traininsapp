import { useId, useState, type SyntheticEvent } from 'react';
import { useI18n } from '@/core/i18n';
import {
  useTraining,
  WORKOUT_NOTES_MAX_LENGTH,
  WORKOUT_TITLE_MAX_LENGTH,
  type Workout,
} from '@/core/training';
import { Button, Sheet } from '@/ui';
import styles from './ExerciseFormSheet.module.css';

/** Title and notes of a workout. */
export function WorkoutDetailsSheet({
  workout,
  onClose,
}: {
  workout: Workout;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { mutate } = useTraining();
  const titleId = useId();
  const notesId = useId();
  const [title, setTitle] = useState(workout.title ?? '');
  const [notes, setNotes] = useState(workout.notes ?? '');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await mutate((s, profileId) => s.workouts.updateDetails(profileId, workout.id, title, notes));
      onClose();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <Sheet title={t('training.workout.details')} onClose={onClose} closeLabel={t('common.close')}>
      <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
        <label htmlFor={titleId} className={styles.label}>
          {t('training.workout.titleLabel')}
        </label>
        <input
          id={titleId}
          className={styles.field}
          value={title}
          maxLength={WORKOUT_TITLE_MAX_LENGTH}
          placeholder={workout.planDayName ?? ''}
          autoComplete="off"
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
        <label htmlFor={notesId} className={styles.label}>
          {t('training.workout.notesLabel')}
        </label>
        <textarea
          id={notesId}
          className={`${styles.field} ${styles.notes}`}
          value={notes}
          rows={4}
          maxLength={WORKOUT_NOTES_MAX_LENGTH}
          onChange={(event) => {
            setNotes(event.target.value);
          }}
        />
        {failed ? (
          <p className={styles.error} role="alert">
            {t('training.errors.saveFailed')}
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
      </form>
    </Sheet>
  );
}
