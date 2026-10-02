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
import type { TargetService } from './targetService';
import type { TargetKind } from './targets';

interface TargetsContextValue {
  service: TargetService;
  profileId: string;
  /** Increments after every change, so readers (settings, score, health) reload. */
  revision: number;
  set: (kind: TargetKind, value: number | null) => Promise<void>;
}

const TargetsContext = createContext<TargetsContextValue | null>(null);

export function TargetsProvider({
  service,
  children,
}: {
  service: TargetService;
  children: ReactNode;
}) {
  const { profile } = useProfile();
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);
  const value = useMemo<TargetsContextValue>(
    () => ({
      service,
      profileId: profile.id,
      revision,
      set: async (kind, next) => {
        await service.set(profile.id, kind, next);
        bump();
      },
    }),
    [service, profile.id, revision, bump],
  );
  return <TargetsContext.Provider value={value}>{children}</TargetsContext.Provider>;
}

export function useTargets(): TargetsContextValue {
  const context = useContext(TargetsContext);
  if (!context) throw new Error('useTargets must be used inside <TargetsProvider>');
  return context;
}

export type TargetsLoadState<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: unknown };

/** Loads target data and reloads after every change. */
export function useTargetData<T>(
  load: (service: TargetService, profileId: string) => Promise<T>,
  deps: readonly unknown[],
): TargetsLoadState<T> {
  const { service, profileId, revision } = useTargets();
  const [state, setState] = useState<TargetsLoadState<T>>({ status: 'loading' });
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
