import type { CSSProperties } from 'react';
import { buildChartGeometry, type ChartBox } from '@/core/health';
import styles from './Progress.module.css';

interface DayBarsProps {
  /** One value per day, oldest first; `null` = no data that day (no mark, not a zero). */
  values: readonly (number | null)[];
  /** Spoken summary of the chart. */
  label: string;
  /** Optional reference value drawn as a dashed line (e.g. the average goal). */
  reference?: number | null;
  /** First and last day, shown under the chart. */
  from: string;
  to: string;
}

/**
 * Small daily bar strip: one quiet bar per day, a short tick for zero, nothing for unknown days.
 * Plain HTML, so bars keep their rounded ends at every width; no animation.
 */
export function DayBars({ values, label, reference = null, from, to }: DayBarsProps) {
  const max = Math.max(1, reference ?? 0, ...values.map((value) => value ?? 0));
  return (
    <span className={styles.chart}>
      <span className={styles.bars} role="img" aria-label={label}>
        {values.map((value, index) => (
          <span key={index} className={styles.column}>
            {value === null ? null : value > 0 ? (
              <span
                className={styles.bar}
                style={{ '--bar-ratio': value / max } as CSSProperties}
              />
            ) : (
              <span className={styles.tick} />
            )}
          </span>
        ))}
        {reference !== null && reference > 0 ? (
          <span
            className={styles.reference}
            style={{ '--bar-ratio': reference / max } as CSSProperties}
          />
        ) : null}
      </span>
      <span className={styles.axis} aria-hidden="true">
        <span>{from}</span>
        <span>{to}</span>
      </span>
    </span>
  );
}

const BOX: ChartBox = { width: 300, height: 64, top: 6, right: 6, bottom: 6, left: 6 };

/** Small weight line over the period; needs two days with a value. */
export function WeightLine({
  points,
  label,
  start,
  end,
}: {
  points: readonly { date: string; value: number }[];
  label: string;
  /** Captions under the chart, e.g. "92,4 kg · 27.09." */
  start: string;
  end: string;
}) {
  const geometry = buildChartGeometry(points, BOX);
  if (!geometry) return null;
  const last = geometry.points.at(-1);
  return (
    <span className={styles.chart}>
      <svg
        className={styles.line}
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        role="img"
        aria-label={label}
      >
        <path className={styles.linePath} d={geometry.path} />
        {geometry.points.length <= 31
          ? geometry.points.map((point) => (
              <circle key={point.date} className={styles.dot} cx={point.x} cy={point.y} r={3} />
            ))
          : null}
        {last ? <circle className={styles.latest} cx={last.x} cy={last.y} r={4} /> : null}
      </svg>
      <span className={styles.axis} aria-hidden="true">
        <span>{start}</span>
        <span>{end}</span>
      </span>
    </span>
  );
}
