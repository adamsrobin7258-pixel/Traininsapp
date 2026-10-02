import { useState } from 'react';
import { ROUTES } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { getDeviceLanguages } from '@/core/platform';
import {
  LANGUAGE_PREFERENCES,
  resolveLocale,
  THEME_PREFERENCES,
  WEIGHT_UNIT_PREFERENCES,
  useSettings,
} from '@/core/settings';
import { List, ListRow, Screen, Section, SegmentedControl } from '@/ui';
import { DataSourcesSheet } from '../components/DataSourcesSheet';
import { HealthDataSection } from '../components/HealthDataSection';
import { PrivacySection } from '../components/PrivacySection';
import { WaterQuickAmountsSection } from '../components/WaterQuickAmountsRow';

function reportError(error: unknown) {
  console.error(error);
}

/**
 * Einstellungen → App: how Kalethra looks and behaves – appearance, units, language, water quick
 * buttons, Health Connect, privacy and storage, about. No goals here (Einstellungen → Ziele).
 */
export function AppSettingsScreen() {
  const { t } = useI18n();
  const { settings, updateSetting } = useSettings();
  const deviceLocale = resolveLocale('system', getDeviceLanguages());
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const themeOptions = THEME_PREFERENCES.map((value) => ({
    value,
    label: t(`profile.theme.${value}`),
  }));
  const languageOptions = LANGUAGE_PREFERENCES.map((value) => ({
    value,
    label: value === 'system' ? t('profile.language.system') : t(`languages.${value}`),
  }));

  return (
    <Screen
      title={t('settings.app.title')}
      back={{ to: ROUTES.settings, label: t('settings.title') }}
    >
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

      <Section title={t('profile.unitsTitle')}>
        <SegmentedControl
          label={t('profile.weightUnitLabel')}
          options={WEIGHT_UNIT_PREFERENCES.map((value) => ({ value, label: value }))}
          value={settings.weightUnit}
          onChange={(value) => {
            updateSetting('weightUnit', value).catch(reportError);
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

      <WaterQuickAmountsSection />

      <HealthDataSection />

      <PrivacySection />

      <Section title={t('profile.aboutTitle', { appName: t('app.name') })}>
        <List>
          <ListRow title={t('profile.version')} value={__APP_VERSION__} />
          <ListRow
            title={t('profile.dataSources.title')}
            onPress={() => {
              setSourcesOpen(true);
            }}
          />
        </List>
      </Section>
      {sourcesOpen ? (
        <DataSourcesSheet
          onClose={() => {
            setSourcesOpen(false);
          }}
        />
      ) : null}
    </Screen>
  );
}
