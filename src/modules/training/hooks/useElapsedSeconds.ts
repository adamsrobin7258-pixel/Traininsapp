import { useEffect, useState } from 'react';

const TICK_MS = 15_000;

/** Seconds since `startedAt`, refreshed every 15 s. Based on timestamps, so it survives pauses. */
export function useElapsedSeconds(startedAt: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => {
      window.clearInterval(id);
    };
  }, []);
  return Math.max(0, Math.round((now - Date.parse(startedAt)) / 1000));
}
