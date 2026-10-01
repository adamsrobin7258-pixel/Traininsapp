import { setSystemBarsTheme } from '@/core/platform';
import type { ResolvedTheme } from '@/core/settings';

/** Background colors per theme; must match --color-bg in src/ui/tokens.css. */
const BROWSER_THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#f4f3ee',
  dark: '#0f1210',
};

/** Applies the resolved theme to the document and the native system bars. */
export function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', BROWSER_THEME_COLOR[theme]);
  setSystemBarsTheme(theme);
}
