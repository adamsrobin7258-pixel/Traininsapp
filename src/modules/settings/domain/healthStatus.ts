import type { HealthStatusView } from '@/core/health';
import type { TranslationKey } from '@/core/i18n';

/** Status label of the integration; "syncing" wins while a sync runs. */
export function healthStatusKey(status: HealthStatusView, syncing: boolean): TranslationKey {
  if (syncing) return 'healthConnect.status.syncing';
  if (status.state === 'connected' && status.lastResult === 'failed') {
    return 'healthConnect.status.failed';
  }
  return `healthConnect.status.${status.state}`;
}
