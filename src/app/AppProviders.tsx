import { useLayoutEffect, type ReactNode } from 'react';
import { I18nProvider } from '@/core/i18n';
import { getDeviceLanguages } from '@/core/platform';
import { resolveLocale, resolveTheme, SettingsProvider, useSettings } from '@/core/settings';
import { WeightProvider } from '@/core/health';
import { StorageProvider } from '@/core/storage';
import { TrainingProvider } from '@/core/training';
import { SyncProvider } from '@/core/sync';
import { applyTheme, useSystemPrefersDark } from '@/core/theme';
import { ProfileProvider } from '@/core/user';
import type { AppServices, InitialState } from './services';

interface AppProvidersProps {
  services: AppServices;
  initialState: InitialState;
  children: ReactNode;
}

export function AppProviders({ services, initialState, children }: AppProvidersProps) {
  return (
    <SettingsProvider service={services.settings} initialSettings={initialState.settings}>
      <PreferencesBridge>
        <ProfileProvider service={services.profile} initialProfile={initialState.profile}>
          <SyncProvider service={services.sync}>
            <StorageProvider service={services.storage}>
              <WeightProvider service={services.weight}>
                <TrainingProvider services={services.training}>{children}</TrainingProvider>
              </WeightProvider>
            </StorageProvider>
          </SyncProvider>
        </ProfileProvider>
      </PreferencesBridge>
    </SettingsProvider>
  );
}

/** Turns the stored preferences into the effective theme and language. */
function PreferencesBridge({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const systemPrefersDark = useSystemPrefersDark();
  const theme = resolveTheme(settings.theme, systemPrefersDark);
  const locale = resolveLocale(settings.language, getDeviceLanguages());

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <I18nProvider locale={locale}>{children}</I18nProvider>;
}
