import type { ReactNode } from 'react';
import styles from './Screen.module.css';

interface ScreenProps {
  title: string;
  /** Small line above the title, e.g. the current date. */
  eyebrow?: string;
  children: ReactNode;
}

/** Top-level layout of every tab: large title header and scrollable content. */
export function Screen({ title, eyebrow, children }: ScreenProps) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1 className={styles.title}>{title}</h1>
      </header>
      <div className={styles.content}>{children}</div>
    </main>
  );
}
