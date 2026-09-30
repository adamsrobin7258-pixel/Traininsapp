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
import type { WeightEntry } from './weight';
import type { SaveWeightResult, WeightPeriod, WeightService } from './weightService';

interface WeightContextValue {
  service: WeightService;
  profileId: string;
  /** Increments after every change, so readers reload. */
  revision: number;
  save: (date: string, kg: number) => Promise<SaveWeightResult>;
  update: (id: string, kg: number) => Promise<WeightEntry>;
  remove: (id: string) => Promise<void>;
}

const WeightContext = createContext<WeightContextValue | null>(null);

export function WeightProvider({
  service,
  children,
}: {
  service: WeightService;
  children: ReactNode;
}) {
  const { profile } = useProfile();
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const value = useMemo<WeightContextValue>(
    () => ({
      service,
      profileId: profile.id,
      revision,
      save: async (date, kg) => {
        const result = await service.save(profile.id, date, kg);
        bump();
        return result;
      },
      update: async (id, kg) => {
        const entry = await service.update(profile.id, id, kg);
        bump();
        return entry;
      },
      remove: async (id) => {
        await service.delete(profile.id, id);
        bump();
      },
    }),
    [service, profile.id, revision, bump],
  );

  return <WeightContext.Provider value={value}>{children}</WeightContext.Provider>;
}

export function useWeightService(): WeightContextValue {
  const context = useContext(WeightContext);
  if (!context) throw new Error('useWeightService must be used inside <WeightProvider>');
  return context;
}

export type LoadState<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: unknown };

/**
 * Loads data through the weight service and reloads after changes. Only the given query runs;
 * nothing is loaded on unrelated re-renders.
 */
export function useWeightData<T>(
  load: (service: WeightService, profileId: string) => Promise<T>,
  deps: readonly unknown[],
): LoadState<T> {
  const { service, profileId, revision } = useWeightService();
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });

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
    // `load` is intentionally described by `deps`; callers pass inline functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, profileId, revision, ...deps]);

  return state;
}

export function useWeightForDate(date: string) {
  return useWeightData((service, profileId) => service.getForDate(profileId, date), [date]);
}

export function useLatestWeight() {
  return useWeightData((service, profileId) => service.getLatest(profileId), []);
}

export function useWeightTrend(period: WeightPeriod) {
  return useWeightData((service, profileId) => service.getTrend(profileId, period), [period]);
}
