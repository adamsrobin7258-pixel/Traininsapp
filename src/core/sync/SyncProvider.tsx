import { createContext, useContext, type ReactNode } from 'react';
import type { SyncService } from './types';

const SyncContext = createContext<SyncService | null>(null);

export function SyncProvider({ service, children }: { service: SyncService; children: ReactNode }) {
  return <SyncContext.Provider value={service}>{children}</SyncContext.Provider>;
}

export function useSyncService(): SyncService {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSyncService must be used inside <SyncProvider>');
  return context;
}
