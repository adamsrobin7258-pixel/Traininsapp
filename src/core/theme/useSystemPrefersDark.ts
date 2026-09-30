import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => {
    media.removeEventListener('change', onChange);
  };
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

/** Tracks the operating system's light/dark preference. */
export function useSystemPrefersDark(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
