import { useId, useState, type SyntheticEvent } from 'react';
import { Button } from './Button';
import { Sheet } from './Sheet';
import styles from './Dialogs.module.css';

interface PromptSheetProps {
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  maxLength?: number;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  /** Saves the value. Throwing keeps the sheet open; `describeError` turns it into text. */
  onSubmit: (value: string) => Promise<void>;
  describeError: (error: unknown) => string;
  onClose: () => void;
}

/** Single text field in a bottom sheet, e.g. for naming a plan. */
export function PromptSheet({
  title,
  label,
  initialValue = '',
  placeholder,
  maxLength,
  confirmLabel,
  cancelLabel,
  closeLabel,
  onSubmit,
  describeError,
  onClose,
}: PromptSheetProps) {
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit(value);
    } catch (failure) {
      setError(describeError(failure));
      setBusy(false);
    }
  }

  return (
    <Sheet title={title} onClose={onClose} closeLabel={closeLabel}>
      <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
        <input
          id={inputId}
          className={styles.input}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
        />
        {error ? (
          <p id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button type="submit" disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
