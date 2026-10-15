import { useEffect } from 'react';
import { useHealthExport, useHealthSync } from '@/core/health';
import { onAppForeground } from '@/core/platform';

/**
 * Starts the Health Connect import at app start and whenever the app returns to the
 * foreground, and retries waiting exports (Settings → App → Health Connect). The service throttles automatic syncs to one per 15 minutes and does nothing
 * while the integration is off. No background work: nothing runs while the app is closed.
 * Imported data never reaches the nutrition goals (they follow the user's own weight only).
 */
export function HealthSyncTrigger() {
  const { autoSync } = useHealthSync();
  const { retryWaiting } = useHealthExport();
  useEffect(() => {
    autoSync();
    return onAppForeground(autoSync);
  }, [autoSync]);
  // The optional export: only records still waiting (a failed write, the app closed during one)
  // are tried again – never the whole history. Does nothing while the export is off.
  useEffect(() => {
    retryWaiting();
    return onAppForeground(retryWaiting);
    // retryWaiting changes with the export state; once at start and per foreground is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
