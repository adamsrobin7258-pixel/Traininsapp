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
  EnableResult,
  ExportOptions,
  HealthExportService,
  HealthExportState,
} from './healthExportService';

export type HealthExportView = HealthExportState | { loading: true };

interface HealthExportContextValue {
  state: HealthExportView;
  /** Asks for the permission and turns the export on (only when it was granted). */
  enable: () => Promise<EnableResult>;
  disable: () => Promise<void>;
  /** Fire and forget – never throws, never delays the caller's own work. */
  exportWorkout: (workoutId: string, options?: ExportOptions) => void;
  exportActivity: (activityId: string, options?: ExportOptions) => void;
  /** Records still waiting – app start and return to the foreground. */
  retryWaiting: () => void;
  /** Checks the permission again, e.g. after the user returns from Health Connect. */
  refresh: () => Promise<void>;
}

const HealthExportContext = createContext<HealthExportContextValue | null>(null);

/** The optional Health Connect export for the UI (see `HealthExportService`). */
export function HealthExportProvider({
  service,
  children,
}: {
  service: HealthExportService;
  children: ReactNode;
}) {
  const { profile } = useProfile();
  const [state, setState] = useState<HealthExportView>({ loading: true });
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await service.state(profile.id);
      if (mounted.current) setState(next);
    } catch {
      if (mounted.current) {
        setState({ enabled: false, access: 'unsupported', lastSuccessAt: null, waiting: 0 });
      }
    }
  }, [service, profile.id]);

  useEffect(() => {
    mounted.current = true;
    service.state(profile.id).then(
      (next) => {
        if (mounted.current) setState(next);
      },
      () => {
        if (mounted.current) {
          setState({ enabled: false, access: 'unsupported', lastSuccessAt: null, waiting: 0 });
        }
      },
    );
    return () => {
      mounted.current = false;
    };
  }, [service, profile.id]);

  const after = useCallback(
    (work: Promise<unknown>) => {
      work.then(
        () => refresh(),
        () => refresh(),
      );
    },
    [refresh],
  );

  const value = useMemo<HealthExportContextValue>(
    () => ({
      state,
      enable: async () => {
        try {
          return (await service.enable(profile.id)).result;
        } finally {
          await refresh();
        }
      },
      disable: async () => {
        try {
          await service.disable();
        } finally {
          await refresh();
        }
      },
      exportWorkout: (workoutId, options) => {
        after(service.exportWorkout(profile.id, workoutId, options));
      },
      exportActivity: (activityId, options) => {
        after(service.exportActivity(profile.id, activityId, options));
      },
      retryWaiting: () => {
        after(service.retryWaiting(profile.id));
      },
      refresh,
    }),
    [service, profile.id, state, refresh, after],
  );

  return <HealthExportContext.Provider value={value}>{children}</HealthExportContext.Provider>;
}

export function useHealthExport(): HealthExportContextValue {
  const context = useContext(HealthExportContext);
  if (!context) throw new Error('useHealthExport must be used inside <HealthExportProvider>');
  return context;
}
