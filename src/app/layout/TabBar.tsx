import type { CSSProperties } from 'react';
import { NavLink } from 'react-router';
import { useI18n } from '@/core/i18n';
import { Icon } from '@/ui';
import type { AppModule } from '../moduleTypes';
import styles from './TabBar.module.css';

export function TabBar({ modules }: { modules: readonly AppModule[] }) {
  const { t } = useI18n();
  const tabs = modules.flatMap((module) => (module.tab ? [{ ...module.tab, module }] : []));
  return (
    <nav className={styles.tabBar} aria-label={t('nav.label')}>
      <ul className={styles.items} style={{ '--tab-count': tabs.length } as CSSProperties}>
        {tabs.map(({ module, labelKey, icon }) => (
          <li key={module.id} className={styles.item}>
            <NavLink to={module.path} end={module.path === '/'} className={styles.link}>
              <Icon name={icon} className={styles.icon} />
              <span className={styles.label}>{t(labelKey)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
