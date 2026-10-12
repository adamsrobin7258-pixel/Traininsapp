import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useActivities } from '@/core/activity';
import { useHealthSync, useWeightService } from '@/core/health';
import { useNutrition } from '@/core/nutrition';
import { useTargets } from '@/core/targets';
import { useTraining } from '@/core/training';
import { useProfile } from '@/core/user';
import type { ProgressCalendarDay } from './calendar';
import type { ProgressGoals, ProgressGoalService } from './progressGoalService';

const ProgressGoalsContext = createContext<ProgressGoalService | null>(null);

export function ProgressGoalsProvider({
  service,
  children,
}: {
  service: ProgressGoalService;
  children: ReactNode;
}) {
  return <ProgressGoalsContext.Provider value={service}>{children}</ProgressGoalsContext.Provider>;
}

export type ProgressGoalsLoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: ProgressGoals }
  | { status: 'error'; error: unknown };

export type ProgressCalendarLoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: ProgressCalendarDay[] }
  | { status: 'error'; error: unknown };

type LoadState<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: unknown };

/**
 * One calculation of the service for local days. Recalculated whenever an input changes – food,
 * nutrition goals, workouts (also an edited one), activities, Health Connect, weight or the
 * targets – so it is never stale. While the same days reload, the last result stays, so nothing
 * flickers.
 */
function useProgressCalculation<T>(
  name: string,
  dates: readonly string[],
  today: string,
  calculate: (
    service: ProgressGoalService,
    profileId: string,
    dates: readonly string[],
    today: string,
  ) => Promise<T>,
): LoadState<T> {
  const service = useContext(ProgressGoalsContext);
  if (!service) throw new Error(`${name} must be used inside <ProgressGoalsProvider>`);
  const { profile } = useProfile();
  const { revision: nutrition } = useNutrition();
  const { revision: training } = useTraining();
  const { revision: activity } = useActivities();
  const { revision: health } = useHealthSync();
  const { revision: weight } = useWeightService();
  const { revision: targets } = useTargets();
  const [state, setState] = useState<{ key: string; value: LoadState<T> }>({
    key: '',
    value: { status: 'loading' },
  });
  const key = `${dates.join(',')}|${today}`;

  useEffect(() => {
    let cancelled = false;
    calculate(service, profile.id, dates, today).then(
      (data) => {
        if (!cancelled) setState({ key, value: { status: 'ready', data } });
      },
      (error: unknown) => {
        if (!cancelled) setState({ key, value: { status: 'error', error } });
      },
    );
    return () => {
      cancelled = true;
    };
    // `dates` is described by `key`; `calculate` is a fixed function per hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, profile.id, key, today, nutrition, training, activity, health, weight, targets]);
  // A result of other days is never shown for these.
  return state.key === key ? state.value : { status: 'loading' };
}

/** Goal attainment of a period. */
export function useProgressGoals(
  dates: readonly string[],
  /** Today's local day – from the page's clock (`periodRange`), not computed here again. */
  today: string,
): ProgressGoalsLoadState {
  return useProgressCalculation('useProgressGoals', dates, today, calculateGoals);
}

/** The day calendar: completed workouts and calorie goal per day (Phase 23). */
export function useProgressCalendar(
  dates: readonly string[],
  today: string,
): ProgressCalendarLoadState {
  return useProgressCalculation('useProgressCalendar', dates, today, calculateCalendar);
}

const calculateGoals = (
  service: ProgressGoalService,
  profileId: string,
  dates: readonly string[],
  today: string,
) => service.calculate(profileId, dates, { today });

const calculateCalendar = (
  service: ProgressGoalService,
  profileId: string,
  dates: readonly string[],
  today: string,
) => service.calendar(profileId, dates, { today });
