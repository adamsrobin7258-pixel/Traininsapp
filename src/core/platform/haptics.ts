import { Haptics, NotificationType } from '@capacitor/haptics';
import { isNativePlatform } from './platform';

/**
 * A short, gentle vibration (e.g. when the rest timer ends). Native only; the system decides
 * whether it is felt (vibration settings, battery saver). Never throws – it is a hint, not a
 * function the app depends on.
 */
export function notifyHaptic(): void {
  if (!isNativePlatform()) return;
  Haptics.notification({ type: NotificationType.Success }).catch(() => {
    // No vibrator or not allowed: the visible hint is enough.
  });
}
