import type { Clock } from '@/shared/lib/clock';
import { runStorageSelfTest, type SelfTestResult } from './selfTest';
import type { DatabaseDriver, DatabaseSecurity } from './types';

/** Read-only view of how data is stored, plus the on-device self-test. */
export class StorageService {
  constructor(
    private readonly db: DatabaseDriver,
    readonly security: DatabaseSecurity,
    private readonly clock: Clock,
  ) {}

  runSelfTest(): Promise<SelfTestResult[]> {
    return runStorageSelfTest(this.db, this.security, this.clock);
  }
}
