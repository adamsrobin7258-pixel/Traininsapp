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
  children: ReactNode;
}

/** Top-level layout of every tab: large title header and scrollable content. */
export function Screen({ title, eyebrow, back, action, children }: ScreenProps) {
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
        </div>
      </header>
      <div className={styles.content}>{children}</div>
    </main>
  );
}
