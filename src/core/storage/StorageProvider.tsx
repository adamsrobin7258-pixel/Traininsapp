import { createContext, useContext, type ReactNode } from 'react';
import type { StorageService } from '@/core/database';

const StorageContext = createContext<StorageService | null>(null);

export function StorageProvider({
  service,
  children,
}: {
  service: StorageService;
  children: ReactNode;
}) {
  return <StorageContext.Provider value={service}>{children}</StorageContext.Provider>;
}

export function useStorage(): StorageService {
  const context = useContext(StorageContext);
  if (!context) throw new Error('useStorage must be used inside <StorageProvider>');
  return context;
}
