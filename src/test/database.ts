import { migrate, migrations, type DatabaseDriver } from '@/core/database';
import { openSqlJsDriver } from '@/core/database/drivers/sqlJs';

/** Fresh in-memory SQLite database with the full app schema. */
export async function createTestDatabase(): Promise<DatabaseDriver> {
  const db = await openSqlJsDriver();
  await migrate(db, migrations);
  return db;
}

/** Deterministic clock for tests. */
export function fixedClock(iso = '2026-09-30T08:00:00.000Z') {
  return () => new Date(iso);
}
