import { migrations } from './migrations';
import { migrate } from './migrator';
import type { OpenedDatabase } from './types';

export const DATABASE_NAME = 'kalethra';

/** Opens the platform database and brings its schema up to date. */
export async function openAppDatabase(): Promise<OpenedDatabase> {
  const { openCapacitorSqliteDriver } = await import('./drivers/capacitorSqlite');
  const opened = await openCapacitorSqliteDriver(DATABASE_NAME);
  await migrate(opened.driver, migrations);
  return opened;
}

export { migrate, getSchemaVersion, MigrationError } from './migrator';
export { migrations } from './migrations';
export type { Migration } from './migrations';
export type {
  DatabaseDriver,
  DatabaseSecurity,
  OpenedDatabase,
  SqlExecutor,
  SqlValue,
  RunResult,
} from './types';
export { DatabaseKeyError, type DatabaseKeyProblem } from './errors';
export { StorageService } from './storageService';
export type { SelfTestCheck, SelfTestResult, SelfTestStatus } from './selfTest';
