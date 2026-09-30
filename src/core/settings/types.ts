export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const LANGUAGE_PREFERENCES = ['system', 'de', 'en'] as const;
export type LanguagePreference = (typeof LANGUAGE_PREFERENCES)[number];

export interface AppSettings {
  theme: ThemePreference;
  language: LanguagePreference;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'system',
};
