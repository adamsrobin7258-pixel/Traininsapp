import { useId, type ReactNode } from 'react';
import { Icon, type IconName } from '../icons/Icon';
import styles from './Section.module.css';

interface SectionProps {
  title?: string;
  /** Small orientation icon before the title (decorative). */
  icon?: IconName;
  /** Explanatory text below the content. */
  footer?: string;
  children: ReactNode;
}

export function Section({ title, icon, footer, children }: SectionProps) {
  const titleId = useId();
  return (
    <section className={styles.section} aria-labelledby={title ? titleId : undefined}>
      {title ? (
        <h2 id={titleId} className={styles.title}>
          {icon ? <Icon name={icon} size={20} className={styles.icon} /> : null}
          {title}
        </h2>
      ) : null}
      {children}
      {footer ? <p className={styles.footer}>{footer}</p> : null}
    </section>
  );
}
