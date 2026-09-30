import { detectLocale, type Locale } from '@/core/i18n';
import type { LanguagePreference, ThemePreference } from './types';

export type ResolvedTheme = 'light' | 'dark';

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

export function resolveLocale(
  preference: LanguagePreference,
  deviceLanguages: readonly string[],
): Locale {
  return preference === 'system' ? detectLocale(deviceLanguages) : preference;
}
