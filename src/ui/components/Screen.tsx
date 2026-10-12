import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from '../icons/Icon';
import styles from './Screen.module.css';

interface ScreenProps {
  title: string;
  /** Small line above the title, e.g. the current date. */
  eyebrow?: string;
  /** Link back to the parent screen (sub pages). */
  back?: { to: string; label: string };
  /** Compact control next to the title, e.g. an "Edit" button. */
  action?: ReactNode;
  /**
   * Decorative brand mark at the end of the title row (main page). It never makes the header
   * taller or wraps into its own line: where the row has too little room for the title and the
   * mark (small screen, large system font), the mark is hidden.
   */
  mark?: ReactNode;
  children: ReactNode;
}

/** Top-level layout of every tab: large title header and scrollable content. */
export function Screen({ title, eyebrow, back, action, mark, children }: ScreenProps) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        {back ? (
          <Link to={back.to} className={styles.back}>
            <Icon name="chevronLeft" size={20} />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>
          {action}
          {mark ? <span className={styles.mark}>{mark}</span> : null}
        </div>
      </header>
      <div className={styles.content}>{children}</div>
    </main>
  );
}
