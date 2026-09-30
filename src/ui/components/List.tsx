import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon, type IconName } from '../icons/Icon';
import styles from './List.module.css';

export function List({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul className={styles.list} aria-label={label}>
      {children}
    </ul>
  );
}

interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Right-aligned value, e.g. a measurement or a setting's current state. */
  value?: ReactNode;
  icon?: IconName;
  /** Turns the row into a navigation link. */
  to?: string;
  /** Turns the row into a button. */
  onPress?: () => void;
  /** Styles a button row as an action (accent text, no chevron) instead of an item. */
  action?: boolean;
  disabled?: boolean;
  /** Custom trailing content, e.g. a control. Replaces `value`. */
  trailing?: ReactNode;
}

export function ListRow({
  title,
  subtitle,
  value,
  icon,
  to,
  onPress,
  action = false,
  disabled,
  trailing,
}: ListRowProps) {
  const content = (
    <>
      {icon ? (
        <span className={styles.icon}>
          <Icon name={icon} size={20} />
        </span>
      ) : null}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
      </span>
      {trailing ?? (value !== undefined ? <span className={styles.value}>{value}</span> : null)}
      {to || (onPress && !action) ? (
        <Icon name="chevronRight" size={18} className={styles.chevron} />
      ) : null}
    </>
  );

  return (
    <li className={styles.item}>
      {to ? (
        <Link to={to} className={`${styles.row} ${styles.interactive}`}>
          {content}
        </Link>
      ) : onPress ? (
        <button
          type="button"
          className={`${styles.row} ${styles.interactive} ${styles.button} ${action ? styles.action : ''}`}
          onClick={onPress}
          disabled={disabled}
        >
          {content}
        </button>
      ) : (
        <div className={styles.row}>{content}</div>
      )}
    </li>
  );
}
