import { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { Icon, Sheet } from '@/ui';
import styles from './GoalTargets.module.css';

export interface Choice<T> {
  value: T;
  label: string;
  /** Optional second line, e.g. what a mode does. */
  detail?: string;
}

/**
 * A setting chosen from a list – no keyboard. Saves at once and closes; a failed save stays
 * open with a message.
 */
export function ChoiceSheet<T extends string | number>({
  title,
  hint,
  choices,
  current,
  failedText,
  onChoose,
  onClose,
}: {
  title: string;
  hint?: string;
  choices: readonly Choice<T>[];
  current: T;
  failedText: string;
  onChoose: (value: T) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);

  function choose(value: T) {
    setFailed(false);
    onChoose(value).then(onClose, () => {
      setFailed(true);
    });
  }

  return (
    <Sheet title={title} onClose={onClose} closeLabel={t('common.close')}>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
      <ul className={styles.options} aria-label={title}>
        {choices.map((choice) => {
          const selected = choice.value === current;
          return (
            <li key={choice.value}>
              <button
                type="button"
                className={styles.option}
                aria-pressed={selected}
                onClick={() => {
                  choose(choice.value);
                }}
              >
                <span className={styles.optionText}>
                  <span>{choice.label}</span>
                  {choice.detail ? (
                    <span className={styles.optionDetail}>{choice.detail}</span>
                  ) : null}
                </span>
                {selected ? <Icon name="check" size={20} className={styles.check} /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {failed ? (
        <p className={styles.error} role="alert">
          {failedText}
        </p>
      ) : null}
    </Sheet>
  );
}
