import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useProfile } from '@/core/user';
import type {
  ConnectOutcome,
  HealthConnectionStatus,
  HealthSyncService,
  SyncOutcome,
} from './healthSyncService';

export type HealthStatusView = HealthConnectionStatus | { state: 'loading' };

interface HealthSyncContextValue {
  service: HealthSyncService;
  profileId: string;
  status: HealthStatusView;
  /** True while a sync (automatic or manual) runs. */
  syncing: boolean;
  /** Increments after imported data may have changed, so readers reload. */
  revision: number;
  connect: () => Promise<ConnectOutcome>;
  syncNow: () => Promise<SyncOutcome>;
  /** Shows the permission dialog again for kinds without access, then syncs. */
  requestMissing: () => Promise<SyncOutcome>;
  /** Throttled sync for app start, return to the app and opening a health view. */
  autoSync: () => void;
  disconnect: (deleteImported: boolean) => Promise<void>;
  openSettings: () => Promise<void>;
}

const HealthSyncContext = createContext<HealthSyncContextValue | null>(null);

export function HealthSyncProvider({
  service,
  children,
}: {
  service: HealthSyncService;
  children: ReactNode;
}) {
  const { profile } = useProfile();
  const [status, setStatus] = useState<HealthStatusView>({ state: 'loading' });
  const [syncing, setSyncing] = useState(false);
  const [revision, setRevision] = useState(0);
  const mounted = useRef(true);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await service.status();
      if (mounted.current) setStatus(next);
    } catch {
      if (mounted.current) setStatus({ state: 'unsupported' });
    }
  }, [service]);

  useEffect(() => {
    mounted.current = true;
    service.status().then(
      (next) => {
        if (mounted.current) setStatus(next);
      },
      () => {
        if (mounted.current) setStatus({ state: 'unsupported' });
      },
    );
    return () => {
      mounted.current = false;
    };
  }, [service]);

  const track = useCallback(
    async <T,>(work: () => Promise<T>, showSyncing: boolean): Promise<T> => {
      if (showSyncing) setSyncing(true);
      try {
        return await work();
      } finally {
        if (mounted.current) {
          setSyncing(false);
          setRevision((value) => value + 1);
        }
        await refreshStatus();
      }
    },
    [refreshStatus],
  );

  const autoSync = useCallback(() => {
    // Cheap when off or throttled: the service answers without touching Health Connect.
    service.sync(profile.id, { manual: false }).then(
      (outcome) => {
        if (outcome.kind === 'done' && mounted.current) {
          setRevision((current) => current + 1);
          void refreshStatus();
        }
      },
      () => undefined,
    );
  }, [service, profile.id, refreshStatus]);

  const value = useMemo<HealthSyncContextValue>(
    () => ({
      service,
      profileId: profile.id,
      status,
      syncing,
      revision,
      connect: () => track(() => service.connect(profile.id), true),
      syncNow: () => track(() => service.sync(profile.id, { manual: true }), true),
      requestMissing: () => track(() => service.requestMissingAccess(profile.id), true),
      autoSync,
      disconnect: (deleteImported) =>
        track(() => service.disconnect(profile.id, { deleteImported }), false),
      openSettings: () => service.openSettings(),
    }),
    [service, profile.id, status, syncing, revision, track, autoSync],
  );

  return <HealthSyncContext.Provider value={value}>{children}</HealthSyncContext.Provider>;
}

export function useHealthSync(): HealthSyncContextValue {
  const context = useContext(HealthSyncContext);
  if (!context) throw new Error('useHealthSync must be used inside <HealthSyncProvider>');
  return context;
}

export type ImportedLoadState<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: unknown };

/** Loads imported health data and reloads after every sync. */
export function useImportedHealthData<T>(
  load: (service: HealthSyncService, profileId: string) => Promise<T>,
  deps: readonly unknown[],
): ImportedLoadState<T> {
  const { service, profileId, revision } = useHealthSync();
  const [state, setState] = useState<ImportedLoadState<T>>({ status: 'loading' });
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

/** Runs a throttled sync when a health-related view opens. */
export function useHealthAutoSync(): void {
  const { autoSync } = useHealthSync();
  useEffect(() => {
    autoSync();
  }, [autoSync]);
}
