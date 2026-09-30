/**
 * Platform boundary for GPS tracking (contract only – no implementation in this phase).
 *
 *   Activity/training domain  →  LocationTracker (this file)  →  platform adapter
 *                                                                 ├─ Android: FusedLocationProvider
 *                                                                 │  + foreground service
 *                                                                 └─ iOS: Core Location
 *                                                                    + background location mode
 *
 * Domain code depends only on these types, never on Capacitor, Android or iOS APIs.
 * Design notes, permission flow and lifecycle: docs/GPS_ARCHITECTURE.md.
 */

/** `foreground`: app visible. `background`: continues with the screen locked. */
export type TrackingMode = 'foreground' | 'background';

export type LocationPermission =
  | 'granted' // sufficient for the requested mode
  | 'foreground-only' // background was requested but only "while in use" is granted
  | 'prompt' // not asked yet
  | 'denied'
  | 'restricted'; // blocked by device policy or location services disabled

/** One position fix. Units: metres, metres per second, degrees; time as ISO-8601 UTC. */
export interface LocationSample {
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  horizontalAccuracyM: number;
  verticalAccuracyM: number | null;
  speedMps: number | null;
  courseDeg: number | null;
  recordedAt: string;
}

export interface TrackingOptions {
  mode: TrackingMode;
  /** Minimum movement before a new sample is delivered; trades accuracy for battery. */
  distanceFilterM: number;
  /** Lets the adapter pick platform presets (e.g. iOS activityType, Android priority). */
  activity: 'running' | 'cycling' | 'walking' | 'other';
}

export type TrackingError =
  | { kind: 'permission'; permission: LocationPermission }
  | { kind: 'unavailable' }
  | { kind: 'interrupted'; reason: string };

export interface TrackingSession {
  /** Stops delivery of samples and releases the foreground service / background mode. */
  stop(): Promise<void>;
}

export interface LocationTracker {
  checkPermission(mode: TrackingMode): Promise<LocationPermission>;
  requestPermission(mode: TrackingMode): Promise<LocationPermission>;
  start(
    options: TrackingOptions,
    onSample: (sample: LocationSample) => void,
    onError: (error: TrackingError) => void,
  ): Promise<TrackingSession>;
}
