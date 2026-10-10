import { useCallback, useSyncExternalStore } from 'react';
import { IDLE, type RestTimerState } from '../domain/restTimer';

/**
 * Keeps the rest timer of the workout in progress while its screen is closed: leaving the
 * workout with back and resuming it shows the same rest (timestamps keep it right). Only in
 * memory – a restart of the app starts without a timer – and only for one workout: another
 * workout id reads as idle.
 */
let current: { workoutId: string; state: RestTimerState } | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readRestTimer(workoutId: string): RestTimerState {
  return current?.workoutId === workoutId ? current.state : IDLE;
}

export function writeRestTimer(workoutId: string, state: RestTimerState): void {
  current = { workoutId, state };
  for (const listener of listeners) listener();
}

/** The rest timer state of one workout and a setter, shared by every screen showing it. */
export function useRestTimerState(
  workoutId: string,
): [RestTimerState, (next: RestTimerState) => void] {
  const state = useSyncExternalStore(subscribe, () => readRestTimer(workoutId));
  const set = useCallback(
    (next: RestTimerState) => {
      writeRestTimer(workoutId, next);
    },
    [workoutId],
  );
  return [state, set];
}
