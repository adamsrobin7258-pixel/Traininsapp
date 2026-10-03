import { createContext, useContext } from 'react';

export interface RestTimerApi {
  /** Starts the rest after a completed set (a no-op when the rest time is 0). */
  start: () => void;
}

export const RestTimerContext = createContext<RestTimerApi | null>(null);

/** The rest timer of the workout in progress; `null` elsewhere (e.g. editing history). */
export function useRestTimer(): RestTimerApi | null {
  return useContext(RestTimerContext);
}
