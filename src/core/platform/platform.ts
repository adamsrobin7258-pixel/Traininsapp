import { Capacitor } from '@capacitor/core';

/**
 * Thin boundary around platform APIs. Feature code asks this module instead of
 * calling Capacitor or browser globals directly, which keeps it testable.
 * Future native integrations (HealthKit, Health Connect, camera, notifications,
 * files) get their own adapters here – see docs/ARCHITECTURE.md, "Plattformintegration".
 */
export type Platform = 'ios' | 'android' | 'web';

export function getPlatform(): Platform {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android' ? platform : 'web';
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/** Preferred languages of the device, most preferred first. */
export function getDeviceLanguages(): readonly string[] {
  if (navigator.languages.length > 0) return navigator.languages;
  return navigator.language ? [navigator.language] : [];
}
