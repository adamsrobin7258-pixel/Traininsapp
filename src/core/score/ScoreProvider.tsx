import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useActivities } from '@/core/activity';
import { useHealthSync } from '@/core/health';
import { useNutrition } from '@/core/nutrition';
import { useRecovery } from '@/core/recovery';
import { useSettings } from '@/core/settings';
import { useTargets } from '@/core/targets';
import { useTraining } from '@/core/training';
import { useProfile } from '@/core/user';
import { toLocalDateKey } from '@/shared/lib/date';
import type { ScoreService, ScoreWithTrend } from './scoreService';

const ScoreContext = createContext<ScoreService | null>(null);

export function ScoreProvider({
  service,
  children,
}: {
  service: ScoreService;
  children: ReactNode;
}) {
  return <ScoreContext.Provider value={service}>{children}</ScoreContext.Provider>;
}

export type ScoreLoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: ScoreWithTrend }
  | { status: 'error'; error: unknown };

/**
 * The score of a period and its trend. Recalculated whenever an input changes – food, goals,
 * workouts, activities, Health Connect, recovery, the targets or the settings – so it is never stale.
 */
export function useScore(dates: readonly string[], previousDates: readonly string[]) {
  const service = useContext(ScoreContext);
  if (!service) throw new Error('useScore must be used inside <ScoreProvider>');
  const { profile } = useProfile();
  const { settings } = useSettings();
  const { revision: nutrition } = useNutrition();
  const { revision: training } = useTraining();
  const { revision: activity } = useActivities();
  const { revision: health } = useHealthSync();
  const { revision: recovery } = useRecovery();
  const { revision: targets } = useTargets();
  const [state, setState] = useState<ScoreLoadState>({ status: 'loading' });
  const key = `${dates.join(',')}|${previousDates.join(',')}`;
  const today = toLocalDateKey(new Date());
  const { countActivityCalories } = settings;

  useEffect(() => {
    let cancelled = false;
    service
      .withTrend(profile.id, dates, previousDates, {
        today,
        countActivity: countActivityCalories,
      })
      .then(
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
    // `dates` and `previousDates` are described by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    service,
    profile.id,
    key,
    today,
    countActivityCalories,
    nutrition,
    training,
    activity,
    health,
    recovery,
    targets,
  ]);
  return state;
}
