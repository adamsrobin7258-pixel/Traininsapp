import { useId, useState, type SyntheticEvent } from 'react';
import { useI18n, type TranslationKey } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import {
  parseRepsInput,
  useTraining,
  type PlannedExercise,
  type PlannedTargets,
} from '@/core/training';
import { AUTOFOCUS, Button, Sheet } from '@/ui';
import { describeTrainingError } from '../domain/errors';
import styles from './ExerciseFormSheet.module.css';

type TargetField = keyof PlannedTargets;

/** In display order: the set structure of one exercise, top to bottom. */
const FIELDS: { field: TargetField; label: TranslationKey; hint?: TranslationKey }[] = [
  { field: 'warmupSets', label: 'training.plan.warmupSets' },
  { field: 'targetSets', label: 'training.plan.targetSets' },
  { field: 'targetReps', label: 'training.plan.targetReps' },
  { field: 'dropSets', label: 'training.plan.dropSets', hint: 'training.plan.dropSetsHint' },
];

const text = (value: number | null) => value?.toString() ?? '';

/**
 * Set structure of a planned exercise: warm-up sets, working sets × reps and drops after the
 * last working set. Empty or 0 means "none". Workouts started from the plan copy it.
 */
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
  const baseId = useId();
  const [values, setValues] = useState<Record<TargetField, string>>({
    warmupSets: text(planned.warmupSets),
    targetSets: text(planned.targetSets),
    targetReps: text(planned.targetReps),
    dropSets: text(planned.dropSets),
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const targets: Partial<PlannedTargets> = {};
    for (const { field } of FIELDS) {
      const parsed = parseRepsInput(values[field]);
      if (!parsed.ok) {
        setError(t('training.errors.targets'));
        return;
      }
      // "0" warm-ups or drops simply means none.
      targets[field] = parsed.value === 0 ? null : parsed.value;
    }
    setBusy(true);
    try {
      await mutate((s, profileId) =>
        s.plans.configure(profileId, planned.id, targets as PlannedTargets),
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
        {FIELDS.map(({ field, label, hint }) => (
          <div key={field} className={styles.form}>
            <label htmlFor={`${baseId}-${field}`} className={styles.label}>
              {t(label)}
            </label>
            <input
              {...(field === 'targetSets' ? AUTOFOCUS : {})}
              id={`${baseId}-${field}`}
              className={styles.field}
              inputMode="numeric"
              value={values[field]}
              placeholder="–"
              aria-describedby={hint ? `${baseId}-${field}-hint` : undefined}
              onChange={(event) => {
                setValues((current) => ({ ...current, [field]: event.target.value }));
                setError(null);
              }}
            />
            {hint ? (
              <p id={`${baseId}-${field}-hint`} className={styles.hint}>
                {t(hint)}
              </p>
            ) : null}
          </div>
        ))}
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
