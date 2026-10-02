import { useI18n } from '@/core/i18n';
import { getInitials, type Profile } from '@/core/user';
import { Icon } from '@/ui';
import styles from './ProfileHeader.module.css';

export function ProfileHeader({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  const initials = getInitials(profile.displayName);
  return (
    <div className={styles.header}>
      <span className={styles.avatar} aria-hidden="true">
        {initials || <Icon name="profile" />}
      </span>
      <div className={styles.text}>
        <p className={styles.name}>{profile.displayName ?? t('profile.localProfile')}</p>
        <p className={styles.hint}>{t('profile.localProfileHint')}</p>
      </div>
    </div>
  );
}
