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
import type { ExerciseService } from './exerciseService';
import type { PlanService } from './planService';
import type { WorkoutService } from './workoutService';

export interface TrainingServices {
  exercises: ExerciseService;
  plans: PlanService;
  workouts: WorkoutService;
}

interface TrainingContextValue extends TrainingServices {
  profileId: string;
  /** Increments after every change, so readers reload. */
  revision: number;
  /**
   * Runs a change and refreshes all training views afterwards (also after failures). Changes
   * run strictly one after another in call order: e.g. a field saved on blur is stored before
   * the button tap that caused the blur completes the set or copies it into a new one.
   */
  mutate: <T>(change: (services: TrainingServices, profileId: string) => Promise<T>) => Promise<T>;
}

const TrainingContext = createContext<TrainingContextValue | null>(null);

export function TrainingProvider({
  services,
  children,
}: {
  services: TrainingServices;
  children: ReactNode;
}) {
  const { profile } = useProfile();
  const [revision, setRevision] = useState(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const mutate = useCallback(
    <T,>(change: (s: TrainingServices, profileId: string) => Promise<T>): Promise<T> => {
      const run = async () => {
        try {
          return await change(services, profile.id);
        } finally {
          setRevision((value) => value + 1);
        }
      };
      const result = queue.current.then(run, run);
      queue.current = result.catch(() => undefined);
      return result;
    },
    [services, profile.id],
  );

  const value = useMemo(
    () => ({ ...services, profileId: profile.id, revision, mutate }),
    [services, profile.id, revision, mutate],
  );
  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
}

export function useTraining(): TrainingContextValue {
  const context = useContext(TrainingContext);
  if (!context) throw new Error('useTraining must be used inside <TrainingProvider>');
  return context;
}

export type TrainingLoadState<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: unknown };

/** Loads training data and reloads after changes; only the given query runs. */
export function useTrainingData<T>(
  load: (services: TrainingServices, profileId: string) => Promise<T>,
  deps: readonly unknown[],
): TrainingLoadState<T> {
  const context = useTraining();
  const { exercises, plans, workouts, profileId, revision } = context;
  const [state, setState] = useState<TrainingLoadState<T>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    load({ exercises, plans, workouts }, profileId).then(
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
  }, [exercises, plans, workouts, profileId, revision, ...deps]);

  return state;
}
