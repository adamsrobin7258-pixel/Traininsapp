import { useEffect, useState } from 'react';

const REFRESH_INTERVAL_MS = 60_000;

/** Current time, refreshed every minute so greeting and date stay correct overnight. */
export function useToday(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, []);
  return now;
}
