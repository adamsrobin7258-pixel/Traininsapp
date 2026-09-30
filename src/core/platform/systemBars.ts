import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { isNativePlatform } from './platform';

/** Matches the status/navigation bar icons to the app theme on Android and iOS. */
export function setSystemBarsTheme(theme: 'light' | 'dark'): void {
  if (!isNativePlatform()) return;
  // DARK = light icons on a dark background.
  const style = theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light;
  SystemBars.setStyle({ style }).catch(() => {
    // Cosmetic only; never block the UI because of the system bars.
  });
}
