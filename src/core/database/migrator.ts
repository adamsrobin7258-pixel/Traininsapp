import type { Migration } from './migrations';
import type { DatabaseDriver } from './types';

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY NOT NULL,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );
`;

export class MigrationError extends Error {
  constructor(
    readonly migration: Migration,
    options: { cause: unknown },
  ) {
    super(`Migration ${migration.version} (${migration.name}) failed`, options);
    this.name = 'MigrationError';
  }
}

export function validateMigrations(list: readonly Migration[]): void {
  list.forEach((migration, index) => {
    if (!Number.isInteger(migration.version) || migration.version < 1) {
      throw new Error(`Invalid migration version: ${migration.version}`);
    }
    const previous = list[index - 1];
    if (previous && migration.version <= previous.version) {
      throw new Error(
        `Migrations must be strictly ascending: ${previous.version} -> ${migration.version}`,
      );
    }
  });
}

export async function getSchemaVersion(db: DatabaseDriver): Promise<number> {
  await db.execute(CREATE_MIGRATIONS_TABLE);
  const rows = await db.query<{ version: number | null }>(
    'SELECT MAX(version) AS version FROM schema_migrations',
  );
  return rows[0]?.version ?? 0;
}

/**
 * Applies all pending migrations, each in its own transaction.
 * Returns the versions that were applied.
 */
export async function migrate(
  db: DatabaseDriver,
  list: readonly Migration[],
  now: () => Date = () => new Date(),
): Promise<number[]> {
  validateMigrations(list);
  const current = await getSchemaVersion(db);
  const latestKnown = list.at(-1)?.version ?? 0;
  if (current > latestKnown) {
    throw new Error(
      `Database schema version ${current} is newer than this app supports (${latestKnown}).`,
    );
  }

  const applied: number[] = [];
  for (const migration of list.filter((m) => m.version > current)) {
    try {
      await db.transaction(async (tx) => {
        await tx.execute(migration.up);
        await tx.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [
          migration.version,
          migration.name,
          now().toISOString(),
        ]);
      });
    } catch (cause) {
      throw new MigrationError(migration, { cause });
    }
    applied.push(migration.version);
  }
  return applied;
}
