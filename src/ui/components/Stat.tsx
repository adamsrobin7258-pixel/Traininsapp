import { EmptyValue } from './EmptyValue';
import styles from './Stat.module.css';

interface StatProps {
  label: string;
  /** Pre-formatted value; `null` renders a neutral placeholder. */
  value: string | null;
  /** Accessible text used when there is no value. */
  emptyLabel: string;
}

/** A single key figure: large tabular number with a short label. */
export function Stat({ label, value, emptyLabel }: StatProps) {
  return (
    <div className={styles.stat}>
      <span className={styles.value} data-empty={value === null}>
        {value ?? <EmptyValue label={emptyLabel} />}
      </span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
