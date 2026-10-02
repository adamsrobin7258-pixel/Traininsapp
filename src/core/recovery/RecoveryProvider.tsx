import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useProfile } from '@/core/user';
import type { RecoveryEntry, RecoveryInput } from './recovery';
import type { RecoveryService } from './recoveryService';

interface RecoveryContextValue {
  service: RecoveryService;
  profileId: string;
  /** Increments after every change, so readers (health, progress score) reload. */
  revision: number;
  save: (localDate: string, input: RecoveryInput) => Promise<RecoveryEntry | null>;
}

const RecoveryContext = createContext<RecoveryContextValue | null>(null);

export function RecoveryProvider({
  service,
  children,
}: {
  service: RecoveryService;
  children: ReactNode;
}) {
  const { profile } = useProfile();
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);
  const value = useMemo<RecoveryContextValue>(
    () => ({
      service,
      profileId: profile.id,
      revision,
      save: async (localDate, input) => {
        const entry = await service.save(profile.id, localDate, input);
        bump();
        return entry;
      },
    }),
    [service, profile.id, revision, bump],
  );
  return <RecoveryContext.Provider value={value}>{children}</RecoveryContext.Provider>;
}

export function useRecovery(): RecoveryContextValue {
  const context = useContext(RecoveryContext);
  if (!context) throw new Error('useRecovery must be used inside <RecoveryProvider>');
  return context;
}

export type RecoveryLoadState<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: unknown };

/** Loads recovery data and reloads after every change. */
export function useRecoveryData<T>(
  load: (service: RecoveryService, profileId: string) => Promise<T>,
  deps: readonly unknown[],
): RecoveryLoadState<T> {
  const { service, profileId, revision } = useRecovery();
  const [state, setState] = useState<RecoveryLoadState<T>>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    load(service, profileId).then(
      (data) => {
        if (!cancelled) setState({ status: 'ready', data });
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'error', error });
      },
    );
    return () => {
      cancelled = true;
    };
    // `load` is described by `deps`; callers pass inline functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, profileId, revision, ...deps]);
  return state;
}
