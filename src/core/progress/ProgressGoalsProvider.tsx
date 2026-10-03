import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useActivities } from '@/core/activity';
import { useHealthSync, useWeightService } from '@/core/health';
import { useNutrition } from '@/core/nutrition';
import { useTargets } from '@/core/targets';
import { useTraining } from '@/core/training';
import { useProfile } from '@/core/user';
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

/**
 * Goal attainment of a period. Recalculated whenever an input changes – food, nutrition goals,
 * workouts (also an edited one), activities, Health Connect, weight or the targets – so it is
 * never stale. While the same period reloads, the last result stays, so the cards do not flicker.
 */
export function useProgressGoals(
  dates: readonly string[],
  /** Today's local day – from the page's clock (`periodRange`), not computed here again. */
  today: string,
): ProgressGoalsLoadState {
  const service = useContext(ProgressGoalsContext);
  if (!service) throw new Error('useProgressGoals must be used inside <ProgressGoalsProvider>');
  const { profile } = useProfile();
  const { revision: nutrition } = useNutrition();
  const { revision: training } = useTraining();
  const { revision: activity } = useActivities();
  const { revision: health } = useHealthSync();
  const { revision: weight } = useWeightService();
  const { revision: targets } = useTargets();
  const [state, setState] = useState<{ key: string; value: ProgressGoalsLoadState }>({
    key: '',
    value: { status: 'loading' },
  });
  const key = `${dates.join(',')}|${today}`;

  useEffect(() => {
    let cancelled = false;
    service.calculate(profile.id, dates, { today }).then(
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
    // `dates` is described by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, profile.id, key, today, nutrition, training, activity, health, weight, targets]);
  // A result of another period is never shown for this one.
  return state.key === key ? state.value : { status: 'loading' };
}
