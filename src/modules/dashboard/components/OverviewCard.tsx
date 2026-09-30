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
export function OverviewStat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <span className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
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

export function OverviewNote({ children }: { children: ReactNode }) {
  return <span className={styles.note}>{children}</span>;
}
