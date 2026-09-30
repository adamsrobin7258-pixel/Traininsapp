import { migrations } from './migrations';
import { migrate } from './migrator';
import type { DatabaseDriver } from './types';

export const DATABASE_NAME = 'kalethra';

/** Opens the platform database and brings its schema up to date. */
export async function openAppDatabase(): Promise<DatabaseDriver> {
  const { openCapacitorSqliteDriver } = await import('./drivers/capacitorSqlite');
  const db = await openCapacitorSqliteDriver(DATABASE_NAME);
  await migrate(db, migrations);
  return db;
}

export { migrate, getSchemaVersion, MigrationError } from './migrator';
export { migrations } from './migrations';
export type { Migration } from './migrations';
export type { DatabaseDriver, SqlExecutor, SqlValue, RunResult } from './types';
