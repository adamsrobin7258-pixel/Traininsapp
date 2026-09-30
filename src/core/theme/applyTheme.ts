import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { isNativePlatform } from '@/core/platform';
import type { ResolvedTheme } from '@/core/settings';

/** Background colors per theme; must match --color-bg in src/ui/tokens.css. */
const BROWSER_THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#f5f4f1',
  dark: '#0e0f11',
};

/** Applies the resolved theme to the document and the native system bars. */
export function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', BROWSER_THEME_COLOR[theme]);

  if (isNativePlatform()) {
    // DARK = light icons on a dark background.
    const style = theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light;
    SystemBars.setStyle({ style }).catch(() => {
      // Cosmetic only; never block the UI because of the status bar.
    });
  }
}
