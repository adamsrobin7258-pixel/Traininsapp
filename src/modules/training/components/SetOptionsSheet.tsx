import { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { allowedSetTypes, useTraining, type WorkoutSet } from '@/core/training';
import { Button, Icon, Sheet } from '@/ui';
import styles from './SetOptionsSheet.module.css';

/**
 * Options of one set: its type (warm-up, working set, drop – only the valid ones) and delete.
 * Values stay when the type changes. Chosen from a list – no keyboard.
 */
export function SetOptionsSheet({
  set,
  sets,
  label,
  onClose,
}: {
  set: WorkoutSet;
  /** All sets of the exercise, to know which types are possible. */
  sets: readonly WorkoutSet[];
  label: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { mutate } = useTraining();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const types = [set.setType, ...allowedSetTypes(sets, set.id)];
  const order = ['warmup', 'working', 'drop'] as const;

  function run(change: Parameters<typeof mutate>[0]) {
    setBusy(true);
    setFailed(false);
    mutate(change).then(onClose, () => {
      setFailed(true);
      setBusy(false);
    });
  }

  return (
    <Sheet
      title={t('training.workout.setOptions', { label })}
      onClose={onClose}
      closeLabel={t('common.close')}
    >
      <p className={styles.hint}>{t('training.workout.setTypeHint')}</p>
      <ul className={styles.options} aria-label={t('training.workout.setTypeTitle')}>
        {order
          .filter((type) => types.includes(type))
          .map((type) => {
            const selected = type === set.setType;
            return (
              <li key={type}>
                <button
                  type="button"
                  className={styles.option}
                  aria-pressed={selected}
                  disabled={busy}
                  onClick={() => {
                    if (selected) onClose();
                    else run((s, profileId) => s.workouts.changeSetType(profileId, set.id, type));
                  }}
                >
                  <span>{t(`training.workout.setTypes.${type}`)}</span>
                  {selected ? <Icon name="check" size={20} /> : null}
                </button>
              </li>
            );
          })}
      </ul>
      {failed ? (
        <p className={styles.error} role="alert">
          {t('training.errors.saveFailed')}
        </p>
      ) : null}
      <Button
        variant="destructive"
        fullWidth
        disabled={busy}
        onClick={() => {
          run((s, profileId) => s.workouts.deleteSet(profileId, set.id));
        }}
      >
        {t('training.workout.deleteSet')}
      </Button>
    </Sheet>
  );
}
