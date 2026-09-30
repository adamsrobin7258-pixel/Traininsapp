import { NavLink } from 'react-router';
import { useI18n } from '@/core/i18n';
import { Icon } from '@/ui';
import type { AppModule } from '../moduleTypes';
import styles from './TabBar.module.css';

export function TabBar({ modules }: { modules: readonly AppModule[] }) {
  const { t } = useI18n();
  return (
    <nav className={styles.tabBar} aria-label={t('nav.label')}>
      <ul className={styles.items}>
        {modules.map((module) => (
          <li key={module.id} className={styles.item}>
            <NavLink to={module.path} end={module.path === '/'} className={styles.link}>
              <Icon name={module.icon} className={styles.icon} />
              <span className={styles.label}>{t(module.navLabelKey)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
