import type { CSSProperties } from 'react';
import { useI18n } from '@/core/i18n';
import type { ExerciseType, WorkoutSet } from '@/core/training';
import { dismissKeyboard, Icon } from '@/ui';
import { headerKey } from '../domain/setFields';
import { useSetDraft } from '../hooks/useSetDraft';
import styles from './SetRow.module.css';

interface SetRowProps {
  set: WorkoutSet;
  /** Spoken name of the set, e.g. "Satz 2", "Aufwärmsatz 1", "Drop 1 zu Satz 3". */
  label: string;
  /** Short visible marker: "2", "A1", "↓". */
  badge: string;
  /** Names of the check button, e.g. "Satz 2 abschließen" / "Satz 2 wieder öffnen". */
  completeLabel: string;
  reopenLabel: string;
  exerciseType: ExerciseType;
  /** Opens type change and delete for this set ("Optionen für Satz 2"). */
  optionsLabel: string;
  onOptions: () => void;
}

/**
 * One set: large numeric inputs, saved when a field loses focus; the check button completes
 * the set (validated in the service) or reopens it.
 *
 * The check button is a plain button: it never keeps or moves focus into a text field, so it
 * cannot bring up the keyboard. If a field is still focused, it is blurred first – its own
 * save runs before the toggle because training changes are queued (see `mutate`). Entry and
 * saving are shared with the focus view (`useSetDraft`); a double tap completes only once.
 */
export function SetRow({
  set,
  label,
  badge,
  completeLabel,
  reopenLabel,
  exerciseType,
  optionsLabel,
  onOptions,
}: SetRowProps) {
  const { t } = useI18n();
  const { fields, drafts, invalid, error, completed, saving, setDraft, save } = useSetDraft(
    set,
    exerciseType,
  );

  return (
    <div className={styles.row} data-completed={set.completed} data-type={set.setType}>
      <div className={styles.grid} style={{ '--fields': fields.length } as CSSProperties}>
        <button
          type="button"
          className={styles.number}
          aria-label={optionsLabel}
          onClick={() => {
            dismissKeyboard();
            onOptions();
          }}
        >
          {badge}
        </button>
        {fields.map((field) => (
          <input
            key={field}
            className={styles.input}
            aria-label={`${label}: ${t(headerKey(field, exerciseType))}`}
            aria-invalid={invalid.includes(field)}
            inputMode={field === 'reps' || field === 'durationS' ? 'numeric' : 'decimal'}
            enterKeyHint="done"
            autoComplete="off"
            value={drafts[field]}
            placeholder="–"
            onChange={(event) => {
              setDraft(field, event.target.value);
            }}
            onBlur={() => void save(completed)}
          />
        ))}
        <button
          type="button"
          className={styles.check}
          aria-pressed={set.completed}
          aria-label={set.completed ? reopenLabel : completeLabel}
          aria-disabled={saving}
          onClick={() => {
            dismissKeyboard();
            if (!saving) void save(!completed);
          }}
        >
          <Icon name="check" size={22} />
        </button>
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
