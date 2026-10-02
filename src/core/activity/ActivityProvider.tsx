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
import type { ManualActivity, ManualActivityInput } from './manualActivity';
import type { ManualActivityService } from './manualActivityService';

interface ActivityContextValue {
  service: ManualActivityService;
  profileId: string;
  /** Increments after every change, so readers (list, progress, calorie goal) reload. */
  revision: number;
  create: (input: ManualActivityInput) => Promise<ManualActivity>;
  update: (id: string, input: ManualActivityInput) => Promise<ManualActivity>;
  remove: (id: string) => Promise<void>;
}

const ActivityContext = createContext<ActivityContextValue | null>(null);

export function ActivityProvider({
  service,
  children,
}: {
  service: ManualActivityService;
  children: ReactNode;
}) {
  const { profile } = useProfile();
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const value = useMemo<ActivityContextValue>(
    () => ({
      service,
      profileId: profile.id,
      revision,
      create: async (input) => {
        const activity = await service.create(profile.id, input);
        bump();
        return activity;
      },
      update: async (id, input) => {
        const activity = await service.update(profile.id, id, input);
        bump();
        return activity;
      },
      remove: async (id) => {
        await service.delete(profile.id, id);
        bump();
      },
    }),
    [service, profile.id, revision, bump],
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivities(): ActivityContextValue {
  const context = useContext(ActivityContext);
  if (!context) throw new Error('useActivities must be used inside <ActivityProvider>');
  return context;
}

export type ActivityLoadState<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: unknown };

/** Loads manual activity data and reloads after every change. */
export function useActivityData<T>(
  load: (service: ManualActivityService, profileId: string) => Promise<T>,
  deps: readonly unknown[],
): ActivityLoadState<T> {
  const { service, profileId, revision } = useActivities();
  const [state, setState] = useState<ActivityLoadState<T>>({ status: 'loading' });
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
