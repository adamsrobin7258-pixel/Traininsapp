import { useId, type ReactNode } from 'react';
import styles from './Section.module.css';

interface SectionProps {
  title?: string;
  /** Explanatory text below the content. */
  footer?: string;
  children: ReactNode;
}

export function Section({ title, footer, children }: SectionProps) {
  const titleId = useId();
  return (
    <section className={styles.section} aria-labelledby={title ? titleId : undefined}>
      {title ? (
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
      ) : null}
      {children}
      {footer ? <p className={styles.footer}>{footer}</p> : null}
    </section>
  );
}
