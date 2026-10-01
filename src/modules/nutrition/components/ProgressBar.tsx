import { goalProgress } from '@/core/nutrition';
import styles from './Nutrition.module.css';

/** A neutral progress bar towards a goal; values above the goal simply fill it. */
export function ProgressBar({
  value,
  goal,
  label,
  valueText,
}: {
  value: number;
  goal: number;
  label: string;
  valueText: string;
}) {
  const { ratio } = goalProgress(value, goal);
  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuetext={valueText}
    >
      <div className={styles.bar} style={{ width: `${String(ratio * 100)}%` }} />
    </div>
  );
}
