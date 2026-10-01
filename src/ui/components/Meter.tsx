import type { CSSProperties } from 'react';
import styles from './Meter.module.css';

interface MeterProps {
  /** 0–1; values above 1 simply fill the line. */
  ratio: number;
  label: string;
  /** Spoken value, e.g. "1.840 kcal von 2.350 kcal". */
  valueText: string;
  /** Water has its own color; everything else uses the primary color. */
  tone?: 'primary' | 'water';
  size?: 'regular' | 'thin';
}

/**
 * A calm progress line towards a goal. It grows softly when the value changes (not with
 * reduced motion) and never turns red: passing a goal is not an error.
 */
export function Meter({ ratio, label, valueText, tone = 'primary', size = 'regular' }: MeterProps) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <span
      className={styles.track}
      data-tone={tone}
      data-size={size}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuetext={valueText}
    >
      <span className={styles.bar} style={{ '--meter-ratio': clamped } as CSSProperties} />
    </span>
  );
}
