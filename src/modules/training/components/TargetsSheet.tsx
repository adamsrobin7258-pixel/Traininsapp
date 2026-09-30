import { useId, useState, type SyntheticEvent } from 'react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { parseRepsInput, useTraining, type PlannedExercise } from '@/core/training';
import { AUTOFOCUS, Button, Sheet } from '@/ui';
import { describeTrainingError } from '../domain/errors';
import styles from './ExerciseFormSheet.module.css';

/** Optional target sets × reps of a planned exercise. */
export function TargetsSheet({
  planned,
  title,
  onClose,
}: {
  planned: PlannedExercise;
  title: string;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const { mutate } = useTraining();
  const setsId = useId();
  const repsId = useId();
  const [sets, setSets] = useState(planned.targetSets?.toString() ?? '');
  const [reps, setReps] = useState(planned.targetReps?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const parsedSets = parseRepsInput(sets);
    const parsedReps = parseRepsInput(reps);
    if (!parsedSets.ok || !parsedReps.ok) {
      setError(t('training.errors.targets'));
      return;
    }
    setBusy(true);
    try {
      await mutate((s, profileId) =>
        s.plans.setTargets(profileId, planned.id, parsedSets.value, parsedReps.value),
      );
      onClose();
    } catch (failure) {
      setError(describeTrainingError(failure, t, unit, locale));
      setBusy(false);
    }
  }

  return (
    <Sheet title={title} onClose={onClose} closeLabel={t('common.close')}>
      <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
        <label htmlFor={setsId} className={styles.label}>
          {t('training.plan.targetSets')}
        </label>
        <input
          {...AUTOFOCUS}
          id={setsId}
          className={styles.field}
          inputMode="numeric"
          value={sets}
          placeholder="–"
          onChange={(event) => {
            setSets(event.target.value);
            setError(null);
          }}
        />
        <label htmlFor={repsId} className={styles.label}>
          {t('training.plan.targetReps')}
        </label>
        <input
          id={repsId}
          className={styles.field}
          inputMode="numeric"
          value={reps}
          placeholder="–"
          onChange={(event) => {
            setReps(event.target.value);
            setError(null);
          }}
        />
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
      </form>
    </Sheet>
  );
}
