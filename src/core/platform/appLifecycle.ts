import { App } from '@capacitor/app';
import { isNativePlatform } from './platform';

/**
 * Calls `handler` whenever the app returns to the foreground (Android/iOS: app state becomes
 * active; browser: the tab becomes visible). Nothing runs in the background.
 */
export function onAppForeground(handler: () => void): () => void {
  if (isNativePlatform()) {
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) handler();
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }
  const listener = () => {
    if (document.visibilityState === 'visible') handler();
  };
  document.addEventListener('visibilitychange', listener);
  return () => {
    document.removeEventListener('visibilitychange', listener);
  };
}
