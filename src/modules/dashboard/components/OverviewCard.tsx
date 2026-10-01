import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from '@/ui';
import styles from './OverviewCard.module.css';

interface OverviewCardProps {
  title: string;
  /** The area this summary comes from; the whole card opens it. */
  to: string;
  children: ReactNode;
}

/** A read-only summary of one area on Today. It never contains inputs or tracking actions. */
export function OverviewCard({ title, to, children }: OverviewCardProps) {
  // The link's name is its whole content, so screen readers announce the summary itself.
  return (
    <Link to={to} className={styles.card}>
      <span className={styles.header}>
        <span className={styles.title}>{title}</span>
        <Icon name="chevronRight" size={18} className={styles.chevron} />
      </span>
      {children}
    </Link>
  );
}

/** Label/value line inside a card. */
export function OverviewLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className={styles.line}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{children}</span>
    </span>
  );
}

/** Small number with a caption, e.g. "2 · Letzte 7 Tage". */
export function OverviewStat({
  value,
  label,
  progress,
}: {
  value: ReactNode;
  label: string;
  /** Optional progress bar shown below the label (see OverviewProgress). */
  progress?: ReactNode;
}) {
  return (
    <span className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      {progress}
    </span>
  );
}

/** A row of stats; `pairs` keeps a 2 × 2 grid (e.g. four nutrition values) on every width. */
export function OverviewStats({
  children,
  pairs = false,
}: {
  children: ReactNode;
  pairs?: boolean;
}) {
  return (
    <span className={styles.stats} data-pairs={pairs}>
      {children}
    </span>
  );
}

/** A slim, read-only progress bar towards a goal. */
export function OverviewProgress({
  label,
  ratio,
  valueText,
}: {
  label: string;
  ratio: number;
  valueText: string;
}) {
  return (
    <span
      className={styles.track}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuetext={valueText}
    >
      <span className={styles.bar} style={{ width: `${String(ratio * 100)}%` }} />
    </span>
  );
}

export function OverviewNote({ children }: { children: ReactNode }) {
  return <span className={styles.note}>{children}</span>;
}
