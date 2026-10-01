import { getPlatform } from '../platform';
import { createHealthConnectPlatform } from './healthConnect';
import type { HealthPlatform } from './types';
import { createUnavailableHealthPlatform } from './unavailable';

export * from './types';

/** The device's health store: Health Connect on Android, nothing elsewhere (yet). */
export function createHealthPlatform(): HealthPlatform {
  return getPlatform() === 'android'
    ? createHealthConnectPlatform()
    : createUnavailableHealthPlatform();
}
