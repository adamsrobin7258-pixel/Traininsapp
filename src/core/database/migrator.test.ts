import { openSqlJsDriver } from './drivers/sqlJs';
import { migrations } from './migrations';
import { getSchemaVersion, migrate, MigrationError, validateMigrations } from './migrator';
import type { DatabaseDriver } from './types';

describe('migrator', () => {
  let db: DatabaseDriver;

  beforeEach(async () => {
    db = await openSqlJsDriver();
  });

  afterEach(async () => {
    await db.close();
  });

  it('applies all migrations to an empty database', async () => {
    const applied = await migrate(db, migrations);

    expect(applied).toEqual(migrations.map((m) => m.version));
    expect(await getSchemaVersion(db)).toBe(migrations.at(-1)?.version);
    const tables = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['app_settings', 'profiles', 'schema_migrations']),
    );
  });

  it('upgrades a version 1 database without losing data', async () => {
    const [v1] = migrations;
    await migrate(db, [v1!]);
    await db.run(
      "INSERT INTO profiles (id, display_name, created_at, updated_at) VALUES ('p1', 'Anna', 'x', 'x')",
    );

    expect(await migrate(db, migrations)).toEqual(migrations.slice(1).map((m) => m.version));
    expect(await db.query('SELECT display_name FROM profiles')).toEqual([{ display_name: 'Anna' }]);
  });

  it('is idempotent', async () => {
    await migrate(db, migrations);
    expect(await migrate(db, migrations)).toEqual([]);
  });

  it('only applies migrations newer than the current version', async () => {
    const first = { version: 1, name: 'one', up: 'CREATE TABLE a (id TEXT);' };
    const second = { version: 2, name: 'two', up: 'CREATE TABLE b (id TEXT);' };
    await migrate(db, [first]);

    expect(await migrate(db, [first, second])).toEqual([2]);
    const rows = await db.query<{ version: number; name: string }>(
      'SELECT version, name FROM schema_migrations ORDER BY version',
    );
    expect(rows).toEqual([
      { version: 1, name: 'one' },
      { version: 2, name: 'two' },
    ]);
  });

  it('rolls back a failing migration completely', async () => {
    const broken = {
      version: 1,
      name: 'broken',
      up: 'CREATE TABLE partial (id TEXT); INSERT INTO missing_table VALUES (1);',
    };

    await expect(migrate(db, [broken])).rejects.toBeInstanceOf(MigrationError);
    expect(await getSchemaVersion(db)).toBe(0);
    const tables = await db.query("SELECT name FROM sqlite_master WHERE name = 'partial'");
    expect(tables).toHaveLength(0);
  });

  it('refuses to open a database created by a newer app version', async () => {
    await migrate(db, [{ version: 99, name: 'future', up: 'SELECT 1;' }]);
    await expect(migrate(db, migrations)).rejects.toThrow(/newer than this app supports/);
  });

  it('rejects migrations that are not strictly ascending', () => {
    expect(() => {
      validateMigrations([
        { version: 2, name: 'b', up: '' },
        { version: 1, name: 'a', up: '' },
      ]);
    }).toThrow(/strictly ascending/);
    expect(() => {
      validateMigrations([{ version: 0, name: 'zero', up: '' }]);
    }).toThrow(/Invalid migration version/);
  });

  it('ships a valid migration list', () => {
    expect(() => {
      validateMigrations(migrations);
    }).not.toThrow();
  });
});

describe('sql.js driver transactions', () => {
  it('commits on success and rolls back on error', async () => {
    const db = await openSqlJsDriver();
    await db.execute('CREATE TABLE items (name TEXT NOT NULL)');

    await db.transaction(async (tx) => {
      await tx.run('INSERT INTO items (name) VALUES (?)', ['kept']);
    });
    await expect(
      db.transaction(async (tx) => {
        await tx.run('INSERT INTO items (name) VALUES (?)', ['discarded']);
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');

    expect(await db.query('SELECT name FROM items')).toEqual([{ name: 'kept' }]);
    await db.close();
  });

  it('serialises overlapping calls instead of mixing them into an open transaction', async () => {
    const db = await openSqlJsDriver();
    await db.execute('CREATE TABLE items (name TEXT NOT NULL)');

    const failing = db.transaction(async (tx) => {
      await tx.run('INSERT INTO items (name) VALUES (?)', ['rolled back']);
      await new Promise((resolve) => setTimeout(resolve, 5));
      throw new Error('abort');
    });
    // Issued while the first transaction is still open: must neither fail nor be rolled back.
    const concurrent = db.transaction(async (tx) => {
      await tx.run('INSERT INTO items (name) VALUES (?)', ['second']);
    });
    const plain = db.run('INSERT INTO items (name) VALUES (?)', ['plain']);

    await expect(failing).rejects.toThrow('abort');
    await concurrent;
    await plain;
    expect(await db.query('SELECT name FROM items ORDER BY rowid')).toEqual([
      { name: 'second' },
      { name: 'plain' },
    ]);
    await db.close();
  });
});
