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
import type { DiaryService } from './diaryService';
import type { FoodLookupService } from './foodLookupService';
import type { FoodService } from './foodService';
import type { GoalService } from './goalService';
import type { MealService } from './mealService';
import type { RecipeService } from './recipeService';

export interface NutritionServices {
  foods: FoodService;
  /** Offline food search (own foods + BLS) and the barcode fallback (Open Food Facts). */
  lookup: FoodLookupService;
  meals: MealService;
  diary: DiaryService;
  recipes: RecipeService;
  goals: GoalService;
}

interface NutritionContextValue {
  services: NutritionServices;
  profileId: string;
  revision: number;
  /** Runs a change (in call order) and lets all nutrition views reload afterwards. */
  mutate: <T>(change: (services: NutritionServices, profileId: string) => Promise<T>) => Promise<T>;
}

const NutritionContext = createContext<NutritionContextValue | null>(null);

/** Same pattern as TrainingProvider: queued changes, revision-based reloading. */
export function NutritionProvider({
  services,
  children,
}: {
  services: NutritionServices;
  children: ReactNode;
}) {
  const { profile } = useProfile();
  const [revision, setRevision] = useState(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const mutate = useCallback(
    <T,>(change: (s: NutritionServices, profileId: string) => Promise<T>): Promise<T> => {
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
    () => ({ services, profileId: profile.id, revision, mutate }),
    [services, profile.id, revision, mutate],
  );
  return <NutritionContext.Provider value={value}>{children}</NutritionContext.Provider>;
}

export function useNutrition(): NutritionContextValue {
  const context = useContext(NutritionContext);
  if (!context) throw new Error('useNutrition must be used inside <NutritionProvider>');
  return context;
}

export type NutritionLoadState<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: unknown };

/** Loads nutrition data and reloads after changes. */
export function useNutritionData<T>(
  load: (services: NutritionServices, profileId: string) => Promise<T>,
  deps: readonly unknown[],
): NutritionLoadState<T> {
  const { services, profileId, revision } = useNutrition();
  const [state, setState] = useState<NutritionLoadState<T>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    load(services, profileId).then(
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
  }, [services, profileId, revision, ...deps]);

  return state;
}
