import { createTestDatabase } from '@/test/database';
import {
  DATA_CATALOG,
  LOCAL_DATABASE_ENCRYPTED,
  findClassification,
  findUnprotectedTables,
  requiresEncryptionAtRest,
  tablesInCategory,
} from './dataCatalog';

async function schemaTables(): Promise<string[]> {
  const db = await createTestDatabase();
  const rows = await db.query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  await db.close();
  return rows.map((row) => row.name);
}

describe('data catalog', () => {
  it('classifies every table created by the migrations', async () => {
    const unclassified = (await schemaTables()).filter((table) => !findClassification(table));
    expect(unclassified, 'Add these tables to src/core/privacy/dataCatalog.ts').toEqual([]);
  });

  it('only lists tables that exist', async () => {
    const tables = new Set(await schemaTables());
    expect(DATA_CATALOG.map((entry) => entry.table).filter((t) => !tables.has(t))).toEqual([]);
  });

  it('has no duplicate entries', () => {
    const names = DATA_CATALOG.map((entry) => entry.table);
    expect(new Set(names).size).toBe(names.length);
  });

  it('blocks health and location data until the database is encrypted', () => {
    expect(
      findUnprotectedTables(DATA_CATALOG, LOCAL_DATABASE_ENCRYPTED),
      'Enable database encryption before storing these tables',
    ).toEqual([]);
  });

  it('detects sensitive tables without encryption', () => {
    const weights = {
      table: 'measurements',
      category: 'health',
      sensitivity: 'health',
      exportable: true,
      deletedWithProfile: true,
      syncable: true,
    } as const;
    expect(findUnprotectedTables([weights], false)).toEqual([weights]);
    expect(findUnprotectedTables([weights], true)).toEqual([]);
  });

  it('deletes all user-owned data together with the profile', () => {
    for (const entry of DATA_CATALOG.filter((e) => e.sensitivity !== 'technical')) {
      expect(entry.deletedWithProfile, entry.table).toBe(true);
    }
  });

  it('never syncs technical tables', () => {
    for (const entry of DATA_CATALOG.filter((e) => e.sensitivity === 'technical')) {
      expect(entry.syncable, entry.table).toBe(false);
    }
  });

  it('groups tables by category', () => {
    expect(tablesInCategory('profile')).toEqual(['profiles', 'goal_targets']);
    expect(requiresEncryptionAtRest('health')).toBe(true);
    expect(requiresEncryptionAtRest('personal')).toBe(false);
  });
});
