import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SettingsService } from './settingsService';
import type { AppSettings } from './types';

interface SettingsContextValue {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface SettingsProviderProps {
  service: SettingsService;
  initialSettings: AppSettings;
  children: ReactNode;
}

export function SettingsProvider({ service, initialSettings, children }: SettingsProviderProps) {
  const [settings, setSettings] = useState(initialSettings);

  const updateSetting = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      const previous = settings[key];
      // Optimistic update keeps the UI instant; revert if persisting fails.
      setSettings((current) => ({ ...current, [key]: value }));
      try {
        await service.update(key, value);
      } catch (error) {
        setSettings((current) => ({ ...current, [key]: previous }));
        throw error;
      }
    },
    [service, settings],
  );

  const value = useMemo(() => ({ settings, updateSetting }), [settings, updateSetting]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside <SettingsProvider>');
  return context;
}
