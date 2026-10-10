import { useId } from 'react';
import { Icon } from '../icons/Icon';
import styles from './Stepper.module.css';

interface StepperProps {
  /** Visible caption above the value, e.g. "Gewicht (kg)". */
  caption: string;
  /** Accessible name of the value field, e.g. "Satz 2: Gewicht". */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Called when the field loses focus (e.g. to save). */
  onBlur?: () => void;
  /** A step down / up; omitted for values that are only typed. */
  onStep?: (direction: 1 | -1) => void;
  decreaseLabel?: string;
  increaseLabel?: string;
  canDecrease?: boolean;
  canIncrease?: boolean;
  /** Whole numbers only (numeric keyboard) or decimals (decimal keyboard with comma). */
  integer?: boolean;
  invalid?: boolean;
}

/**
 * A value with large −/+ buttons on both sides and the number itself as a text field: tapping
 * the number opens the numeric keyboard, the buttons never focus it. Text is kept as typed;
 * the caller parses and saves it.
 */
export function Stepper({
  caption,
  label,
  value,
  onChange,
  onBlur,
  onStep,
  decreaseLabel,
  increaseLabel,
  canDecrease = true,
  canIncrease = true,
  integer = false,
  invalid = false,
}: StepperProps) {
  const captionId = useId();
  return (
    <div className={styles.stepper} role="group" aria-labelledby={captionId}>
      <span id={captionId} className={styles.caption}>
        {caption}
      </span>
      <div className={styles.row} data-steps={onStep ? 'true' : 'false'}>
        {onStep ? (
          <button
            type="button"
            className={styles.step}
            aria-label={decreaseLabel}
            disabled={!canDecrease}
            onClick={() => {
              onStep(-1);
            }}
          >
            <Icon name="minus" size={26} />
          </button>
        ) : null}
        <input
          className={styles.value}
          aria-label={label}
          aria-invalid={invalid}
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          enterKeyHint="done"
          autoComplete="off"
          placeholder="–"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onFocus={(event) => {
            // Typing replaces the value; the keyboard shows where it is.
            event.target.select();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          onBlur={onBlur}
        />
        {onStep ? (
          <button
            type="button"
            className={styles.step}
            aria-label={increaseLabel}
            disabled={!canIncrease}
            onClick={() => {
              onStep(1);
            }}
          >
            <Icon name="plus" size={26} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
