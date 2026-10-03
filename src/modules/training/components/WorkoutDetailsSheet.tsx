import { useId, useState, type SyntheticEvent } from 'react';
import { useI18n } from '@/core/i18n';
import {
  parseRepsInput,
  useTraining,
  WORKOUT_DURATION_LIMITS_MIN,
  WORKOUT_NOTES_MAX_LENGTH,
  WORKOUT_TITLE_MAX_LENGTH,
  type Workout,
} from '@/core/training';
import { Button, Sheet } from '@/ui';
import styles from './ExerciseFormSheet.module.css';

/** Title and notes of a workout – and, once it is finished, its duration in minutes. */
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
  const durationId = useId();
  const finished = workout.status === 'completed';
  const storedMinutes =
    workout.durationS !== null ? String(Math.max(1, Math.round(workout.durationS / 60))) : '';
  const [title, setTitle] = useState(workout.title ?? '');
  const [notes, setNotes] = useState(workout.notes ?? '');
  const [duration, setDuration] = useState(storedMinutes);
  const [durationInvalid, setDurationInvalid] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    let minutes: number | null = null;
    if (finished && duration.trim() !== storedMinutes) {
      const parsed = parseRepsInput(duration);
      const { min, max } = WORKOUT_DURATION_LIMITS_MIN;
      if (!parsed.ok || parsed.value === null || parsed.value < min || parsed.value > max) {
        setDurationInvalid(true);
        return;
      }
      minutes = parsed.value;
    }
    setDurationInvalid(false);
    setBusy(true);
    try {
      await mutate(async (s, profileId) => {
        await s.workouts.updateDetails(profileId, workout.id, title, notes);
        if (minutes !== null) await s.workouts.updateDuration(profileId, workout.id, minutes);
      });
      onClose();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={finished ? t('training.workout.detailsFinished') : t('training.workout.details')}
      onClose={onClose}
      closeLabel={t('common.close')}
    >
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
        {finished ? (
          <>
            <label htmlFor={durationId} className={styles.label}>
              {t('training.detail.durationLabel')}
            </label>
            <input
              id={durationId}
              className={styles.field}
              value={duration}
              inputMode="numeric"
              enterKeyHint="done"
              autoComplete="off"
              aria-invalid={durationInvalid}
              onChange={(event) => {
                setDuration(event.target.value);
              }}
            />
            {durationInvalid ? (
              <p className={styles.error} role="alert">
                {t('training.detail.durationInvalid')}
              </p>
            ) : null}
          </>
        ) : null}
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
