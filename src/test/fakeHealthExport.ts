import {
  HealthExportError,
  type HealthAvailability,
  type HealthExportCalories,
  type HealthExportDistance,
  type HealthExportErrorCode,
  type HealthExportPlatform,
  type HealthExportSession,
  type HealthWriteAccess,
  type HealthWriteType,
} from '@/core/platform/health';

type Stored<T extends { clientRecordId: string; clientRecordVersion: number }> = Map<string, T>;

/**
 * In-memory stand-in for writing to Health Connect. Behaves like the real store on the points
 * that matter: a record with a known client record ID replaces the stored one (when its version
 * is not older) instead of adding a second one, and every record type has its own permission.
 */
export class FakeHealthExport implements HealthExportPlatform {
  availabilityKind: HealthAvailability['kind'] = 'available';
  /** The write permissions granted right now (`granted = true` grants all of them). */
  readonly permissions = new Set<HealthWriteType>();
  /** What the permission dialog grants. */
  grantOnRequest: boolean | readonly HealthWriteType[] = true;
  /** Makes every write fail with this code (until set back to `null`). */
  failWith: HealthExportErrorCode | null = null;
  /** Makes only writes and deletes of this record type fail. */
  failType: HealthWriteType | null = null;
  /** Every session write call, in order (also the failed ones). */
  readonly writes: HealthExportSession[] = [];
  /** Every write or delete call of any type, in order: "<type>:<client record ID>". */
  readonly calls: string[] = [];
  /** The store: client record ID → record, per type. */
  readonly sessions: Stored<HealthExportSession> = new Map();
  readonly calories: Stored<HealthExportCalories> = new Map();
  readonly distances: Stored<HealthExportDistance> = new Map();
  requests = 0;

  get granted(): boolean {
    return this.permissions.has('exercise');
  }

  set granted(value: boolean) {
    this.permissions.clear();
    if (value)
      for (const type of ['exercise', 'activeCalories', 'distance'] as const)
        this.permissions.add(type);
  }

  availability(): Promise<HealthAvailability> {
    return Promise.resolve(
      this.availabilityKind === 'available'
        ? { kind: 'available', platform: 'healthConnect' }
        : { kind: this.availabilityKind },
    );
  }

  checkWriteAccess(): Promise<HealthWriteAccess> {
    const on = (type: HealthWriteType) =>
      this.availabilityKind === 'available' && this.permissions.has(type);
    return Promise.resolve({
      exercise: on('exercise'),
      activeCalories: on('activeCalories'),
      distance: on('distance'),
    });
  }

  requestWriteAccess(): Promise<HealthWriteAccess> {
    this.requests += 1;
    if (this.availabilityKind === 'available') {
      const grant =
        this.grantOnRequest === true
          ? (['exercise', 'activeCalories', 'distance'] as const)
          : this.grantOnRequest === false
            ? []
            : this.grantOnRequest;
      for (const type of grant) this.permissions.add(type);
    }
    return this.checkWriteAccess();
  }

  private check(type: HealthWriteType, clientRecordId: string): HealthExportError | null {
    this.calls.push(`${type}:${clientRecordId}`);
    if (this.availabilityKind !== 'available') return new HealthExportError('unavailable');
    if (!this.permissions.has(type)) return new HealthExportError('permission');
    if (this.failWith) return new HealthExportError(this.failWith);
    if (this.failType === type) return new HealthExportError('failed');
    return null;
  }

  private upsert<T extends { clientRecordId: string; clientRecordVersion: number }>(
    type: HealthWriteType,
    store: Stored<T>,
    record: T,
  ): Promise<void> {
    const error = this.check(type, record.clientRecordId);
    if (error) return Promise.reject(error);
    const stored = store.get(record.clientRecordId);
    if (!stored || stored.clientRecordVersion <= record.clientRecordVersion) {
      store.set(record.clientRecordId, record);
    }
    return Promise.resolve();
  }

  writeExerciseSession(session: HealthExportSession): Promise<void> {
    this.writes.push(session);
    return this.upsert('exercise', this.sessions, session);
  }

  writeActiveCalories(record: HealthExportCalories): Promise<void> {
    return this.upsert('activeCalories', this.calories, record);
  }

  writeDistance(record: HealthExportDistance): Promise<void> {
    return this.upsert('distance', this.distances, record);
  }

  deleteAmount(type: 'activeCalories' | 'distance', clientRecordId: string): Promise<void> {
    const error = this.check(type, `${clientRecordId}#delete`);
    if (error) return Promise.reject(error);
    (type === 'activeCalories' ? this.calories : this.distances).delete(clientRecordId);
    return Promise.resolve();
  }
}
