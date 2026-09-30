import { App } from '@capacitor/app';
import { isNativePlatform } from './platform';

/**
 * Android system back (button or gesture). Once a listener is registered, Android no longer
 * closes the app on its own – the app decides: go up one level, or call `exitApp()` at the
 * root. iOS has no system back and the browser uses its own history, so both are no-ops.
 */
export function onSystemBack(handler: () => void): () => void {
  if (!isNativePlatform()) return () => undefined;
  const listener = App.addListener('backButton', () => {
    handler();
  });
  return () => {
    void listener.then((handle) => handle.remove());
  };
}

/** Leaves the app (Android: moves the task to the back, like the default back behaviour). */
export function exitApp(): void {
  if (!isNativePlatform()) return;
  void App.exitApp();
}
