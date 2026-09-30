import type { SyncService, SyncStatus } from './types';

/** Default implementation while no cloud account exists: data stays on the device. */
export class LocalOnlySyncService implements SyncService {
  getStatus(): SyncStatus {
    return { state: 'disabled' };
  }

  syncNow(): Promise<void> {
    return Promise.resolve();
  }
}
