import type { HealthPlatform } from './types';

/**
 * Test hook for the web build: end-to-end tests define `window.__kalethraHealth` with a fake
 * health store, since Health Connect only exists on Android devices. Never used on devices.
 */
interface HealthHookWindow {
  __kalethraHealth?: HealthPlatform;
}

/** No health store (browser, iOS in this phase): every call reports "unsupported". */
export function createUnavailableHealthPlatform(): HealthPlatform {
  const hook = (window as HealthHookWindow).__kalethraHealth;
  if (hook) return hook;
  const none = () => Promise.reject(new Error('No health store on this platform'));
  return {
    availability: () => Promise.resolve({ kind: 'unsupported' }),
    checkAccess: (kinds) => Promise.resolve({ granted: [], denied: [...kinds] }),
    requestAccess: (kinds) => Promise.resolve({ granted: [], denied: [...kinds] }),
    readWeights: none,
    readDailyTotals: none,
    readWorkouts: none,
    openSettings: () => Promise.resolve(),
  };
}
