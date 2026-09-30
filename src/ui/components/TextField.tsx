import { useId, useState } from 'react';
import styles from './TextField.module.css';

interface TextFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  autoComplete?: string;
  /** Called when editing ends (blur or Enter) and the text changed. */
  onCommit: (value: string) => void;
}

/** Inline text input for list rows. Commits on blur or Enter, reverts on Escape. */
export function TextField({
  label,
  value,
  placeholder,
  maxLength,
  autoComplete,
  onCommit,
}: TextFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);

  // Adopt external changes to `value` (React's "adjust state during render" pattern).
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  function commit() {
    if (draft !== value) onCommit(draft);
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        value={draft}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        enterKeyHint="done"
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') setDraft(value);
        }}
      />
    </div>
  );
}
