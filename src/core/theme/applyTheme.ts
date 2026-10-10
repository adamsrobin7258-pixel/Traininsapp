import { setSystemBarsTheme } from '@/core/platform';
import type { ResolvedTheme } from '@/core/settings';

/** Background colors per theme; must match --color-bg in src/ui/tokens.css. */
const BROWSER_THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#f3efe6',
  dark: '#101612',
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
