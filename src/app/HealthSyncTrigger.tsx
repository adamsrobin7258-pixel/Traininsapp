import { useEffect } from 'react';
import { useHealthSync } from '@/core/health';
import { onAppForeground } from '@/core/platform';

/**
 * Starts the Health Connect import at app start and whenever the app returns to the
 * foreground. The service throttles automatic syncs to one per 15 minutes and does nothing
 * while the integration is off. No background work: nothing runs while the app is closed.
 * Imported data never reaches the nutrition goals (they follow the user's own weight only).
 */
export function HealthSyncTrigger() {
  const { autoSync } = useHealthSync();
  useEffect(() => {
    autoSync();
    return onAppForeground(autoSync);
  }, [autoSync]);
  return null;
}
