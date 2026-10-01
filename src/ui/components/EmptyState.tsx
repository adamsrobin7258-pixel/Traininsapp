import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icons/Icon';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  /** A line icon, or `art` for an illustration (e.g. a FoodArt). */
  icon?: IconName;
  art?: ReactNode;
  title: string;
  body?: string;
  /** One clear next step, e.g. a button. */
  action?: ReactNode;
}

/**
 * Explains briefly what will appear here – short, calm and without a card: a small picture,
 * a title, at most one sentence and one action.
 */
export function EmptyState({ icon, art, title, body, action }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      {art ? (
        <span className={styles.art}>{art}</span>
      ) : icon ? (
        <span className={styles.icon}>
          <Icon name={icon} />
        </span>
      ) : null}
      <p className={styles.title}>{title}</p>
      {body ? <p className={styles.body}>{body}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
