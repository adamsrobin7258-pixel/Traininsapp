import {
  HealthExportError,
  type HealthAvailability,
  type HealthExportErrorCode,
  type HealthExportPlatform,
  type HealthExportSession,
} from '@/core/platform/health';

/**
 * In-memory stand-in for writing to Health Connect. Behaves like the real store on the point
 * that matters: a session with a known client record ID replaces the stored one (when its
 * version is not older) instead of adding a second session.
 */
export class FakeHealthExport implements HealthExportPlatform {
  availabilityKind: HealthAvailability['kind'] = 'available';
  /** Whether the write permission is granted right now. */
  granted = false;
  /** What the permission dialog answers. */
  grantOnRequest = true;
  /** Makes every write fail with this code (until set back to `null`). */
  failWith: HealthExportErrorCode | null = null;
  /** Every write call, in order (also the failed ones). */
  readonly writes: HealthExportSession[] = [];
  /** The store: client record ID → session. */
  readonly sessions = new Map<string, HealthExportSession>();
  requests = 0;

  availability(): Promise<HealthAvailability> {
    return Promise.resolve(
      this.availabilityKind === 'available'
        ? { kind: 'available', platform: 'healthConnect' }
        : { kind: this.availabilityKind },
    );
  }

  checkWriteAccess(): Promise<boolean> {
    return Promise.resolve(this.availabilityKind === 'available' && this.granted);
  }

  requestWriteAccess(): Promise<boolean> {
    this.requests += 1;
    if (this.availabilityKind === 'available' && this.grantOnRequest) this.granted = true;
    return this.checkWriteAccess();
  }

  writeExerciseSession(session: HealthExportSession): Promise<void> {
    this.writes.push(session);
    if (this.availabilityKind !== 'available') {
      return Promise.reject(new HealthExportError('unavailable'));
    }
    if (!this.granted) return Promise.reject(new HealthExportError('permission'));
    if (this.failWith) return Promise.reject(new HealthExportError(this.failWith));
    const stored = this.sessions.get(session.clientRecordId);
    if (!stored || stored.clientRecordVersion <= session.clientRecordVersion) {
      this.sessions.set(session.clientRecordId, session);
    }
    return Promise.resolve();
  }
}
