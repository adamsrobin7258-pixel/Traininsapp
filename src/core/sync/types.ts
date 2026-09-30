/**
 * Contract for the optional cloud synchronisation (not implemented in phase 1).
 * The app talks to this interface only; the concrete backend adapter
 * (see ARCHITECTURE.md, ADR-004) can be swapped without touching feature modules.
 */
export type SyncStatus =
  | { state: 'disabled' }
  | { state: 'idle'; lastSyncedAt: string | null }
  | { state: 'syncing' }
  | { state: 'error'; message: string };

export interface SyncService {
  getStatus(): SyncStatus;
  /** Pushes local changes and pulls remote changes. */
  syncNow(): Promise<void>;
}

/** Fields every synchronisable table carries (see DATABASE.md). */
export interface SyncableRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
