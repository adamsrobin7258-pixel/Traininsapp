import styles from './Nutrition.module.css';

/** Single choice as cards with an explanation each (radio group semantics). */
export function ChoiceCards<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; title: string; text?: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.options} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={styles.option}
          onClick={() => {
            onChange(option.value);
          }}
        >
          <span className={styles.optionTitle}>{option.title}</span>
          {option.text ? <span className={styles.optionText}>{option.text}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Compact single choice as wrapping chips (radio group semantics). */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; title: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.choices} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          data-selected={option.value === value}
          className={styles.chip}
          onClick={() => {
            onChange(option.value);
          }}
        >
          {option.title}
        </button>
      ))}
    </div>
  );
}
