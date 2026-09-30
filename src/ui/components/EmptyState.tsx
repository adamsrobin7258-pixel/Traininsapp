import { Icon, type IconName } from '../icons/Icon';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  body: string;
}

/** Explains what will appear in an area once there is content. */
export function EmptyState({ icon, title, body }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.icon}>
        <Icon name={icon} />
      </span>
      <p className={styles.title}>{title}</p>
      <p className={styles.body}>{body}</p>
    </div>
  );
}
