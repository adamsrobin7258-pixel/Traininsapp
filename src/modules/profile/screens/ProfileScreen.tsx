import { useI18n } from '@/core/i18n';
import { getDeviceLanguages } from '@/core/platform';
import {
  LANGUAGE_PREFERENCES,
  resolveLocale,
  THEME_PREFERENCES,
  useSettings,
} from '@/core/settings';
import { useSyncService } from '@/core/sync';
import { DISPLAY_NAME_MAX_LENGTH, useProfile } from '@/core/user';
import { List, ListRow, Screen, Section, SegmentedControl, TextField } from '@/ui';
import { ProfileHeader } from '../components/ProfileHeader';

function reportError(error: unknown) {
  console.error(error);
}

export function ProfileScreen() {
  const { t } = useI18n();
  const { settings, updateSetting } = useSettings();
  const { profile, rename } = useProfile();
  const syncStatus = useSyncService().getStatus();
  const deviceLocale = resolveLocale('system', getDeviceLanguages());

  const themeOptions = THEME_PREFERENCES.map((value) => ({
    value,
    label: t(`profile.theme.${value}`),
  }));
  const languageOptions = LANGUAGE_PREFERENCES.map((value) => ({
    value,
    label: value === 'system' ? t('profile.language.system') : t(`languages.${value}`),
  }));

  return (
    <Screen title={t('profile.title')}>
      <ProfileHeader profile={profile} />

      <Section>
        <TextField
          label={t('profile.nameLabel')}
          value={profile.displayName ?? ''}
          placeholder={t('profile.namePlaceholder')}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          autoComplete="given-name"
          onCommit={(value) => {
            rename(value).catch(reportError);
          }}
        />
      </Section>

      <Section title={t('profile.appearanceTitle')}>
        <SegmentedControl
          label={t('profile.theme.label')}
          options={themeOptions}
          value={settings.theme}
          onChange={(value) => {
            updateSetting('theme', value).catch(reportError);
          }}
        />
      </Section>

      <Section
        title={t('profile.languageTitle')}
        footer={
          settings.language === 'system'
            ? t('profile.language.systemHint', { language: t(`languages.${deviceLocale}`) })
            : undefined
        }
      >
        <SegmentedControl
          label={t('profile.language.label')}
          options={languageOptions}
          value={settings.language}
          onChange={(value) => {
            updateSetting('language', value).catch(reportError);
          }}
        />
      </Section>

      <Section title={t('profile.dataTitle')} footer={t('profile.dataFooter')}>
        <List>
          <ListRow
            title={t('profile.cloudSync')}
            value={syncStatus.state === 'disabled' ? t('profile.cloudSyncOff') : undefined}
          />
        </List>
      </Section>

      <Section title={t('profile.aboutTitle')}>
        <List>
          <ListRow title={t('profile.version')} value={__APP_VERSION__} />
        </List>
      </Section>
    </Screen>
  );
}
