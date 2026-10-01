import { useId } from 'react';
import styles from './Nutrition.module.css';

/**
 * A number input that opens the numeric keyboard (decimal comma allowed). Text is kept as
 * typed; the form parses it on save and shows `error` below the field.
 */
export function NumberField({
  label,
  value,
  onChange,
  error,
  integer = false,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  integer?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const errorId = useId();
  return (
    <div className={styles.pairItem}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        {...(autoFocus ? { 'data-autofocus': true } : {})}
        id={id}
        className={styles.field}
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        autoComplete="off"
        enterKeyHint="done"
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {error ? (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
