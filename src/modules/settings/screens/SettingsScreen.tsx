import { SETTINGS_LINKS } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { useProfile } from '@/core/user';
import { List, ListRow, Screen, Section } from '@/ui';
import { ProfileHeader } from '../components/ProfileHeader';

/**
 * Einstellungen: what the user wants to reach and how Kalethra is set up – four compact
 * entries. The areas record what actually happened; Fortschritt shows what came of it.
 */
export function SettingsScreen() {
  const { t } = useI18n();
  const { profile } = useProfile();
  return (
    <Screen title={t('settings.title')}>
      <ProfileHeader profile={profile} />
      <Section>
        <List label={t('settings.title')}>
          <ListRow
            icon="profile"
            title={t('settings.profile.title')}
            subtitle={t('settings.profile.summary')}
            to={SETTINGS_LINKS.profile}
          />
          <ListRow
            icon="target"
            title={t('settings.goals.title')}
            subtitle={t('settings.goals.summary')}
            to={SETTINGS_LINKS.goals}
          />
          <ListRow
            icon="plan"
            title={t('settings.content.title')}
            subtitle={t('settings.content.summary')}
            to={SETTINGS_LINKS.content}
          />
          <ListRow
            icon="settings"
            title={t('settings.app.title')}
            subtitle={t('settings.app.summary')}
            to={SETTINGS_LINKS.app}
          />
        </List>
      </Section>
    </Screen>
  );
}
