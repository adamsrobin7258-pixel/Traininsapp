import type { DatabaseDriver } from '@/core/database';
import { ProfileRepository, ProfileService } from '@/core/user';
import { createTestDatabase, fixedClock } from '@/test/database';
import { WeightRepository } from './weightRepository';
import { WeightError, WeightService } from './weightService';

// 2026-10-03 10:00 local time
const clock = () => new Date(2026, 9, 3, 10);

async function setup() {
  const db = await createTestDatabase();
  const profile = await new ProfileService(
    new ProfileRepository(db),
    fixedClock(),
  ).ensureLocalProfile();
  const service = new WeightService(new WeightRepository(db), clock);
  return { db, service, profileId: profile.id };
}

async function rowCount(db: DatabaseDriver) {
  const rows = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM weight_entries');
  return rows[0]?.n;
}

describe('WeightService', () => {
  it('saves and reads the value of a day', async () => {
    const { service, profileId } = await setup();
    const { entry, replaced } = await service.save(profileId, '2026-10-03', 82.4);
    expect(replaced).toBe(false);
    expect(await service.getForDate(profileId, '2026-10-03')).toEqual(entry);
    expect(await service.getForDate(profileId, '2026-10-02')).toBeNull();
  });

  it('replaces the value of a day instead of adding a duplicate', async () => {
    const { db, service, profileId } = await setup();
    const first = await service.save(profileId, '2026-10-03', 82.4);
    const second = await service.save(profileId, '2026-10-03', 81.9);
    expect(second.replaced).toBe(true);
    expect(second.entry.id).toBe(first.entry.id);
    expect(second.entry.createdAt).toBe(first.entry.createdAt);
    expect(await rowCount(db)).toBe(1);
    expect((await service.getForDate(profileId, '2026-10-03'))?.kg).toBe(81.9);
  });

  it('accepts past days and rejects future and malformed dates', async () => {
    const { service, profileId } = await setup();
    await expect(service.save(profileId, '2025-12-31', 80)).resolves.toBeDefined();
    await expect(service.save(profileId, '2026-10-04', 80)).rejects.toEqual(
      new WeightError('future-date'),
    );
    await expect(service.save(profileId, '2026-02-30', 80)).rejects.toEqual(
      new WeightError('invalid-date'),
    );
    await expect(service.getForDate(profileId, 'yesterday')).rejects.toBeInstanceOf(WeightError);
  });

  it('enforces the weight range in the service, not only in the UI', async () => {
    const { service, profileId } = await setup();
    for (const kg of [0, -1, 19.99, 400.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(service.save(profileId, '2026-10-03', kg)).rejects.toEqual(
        new WeightError('out-of-range'),
      );
    }
    await expect(service.save(profileId, '2026-10-03', 20)).resolves.toBeDefined();
    await expect(service.save(profileId, '2026-10-02', 400)).resolves.toBeDefined();
  });

  it('lists history newest first with paging', async () => {
    const { service, profileId } = await setup();
    for (const [date, kg] of [
      ['2026-09-30', 83.2],
      ['2026-10-02', 82.7],
      ['2026-10-01', 83.0],
      ['2026-10-03', 82.4],
    ] as const) {
      await service.save(profileId, date, kg);
    }
    const page1 = await service.getHistory(profileId, 2);
    const page2 = await service.getHistory(profileId, 2, 2);
    expect(page1.map((e) => e.date)).toEqual(['2026-10-03', '2026-10-02']);
    expect(page2.map((e) => e.date)).toEqual(['2026-10-01', '2026-09-30']);
    expect(await service.countEntries(profileId)).toBe(4);
    expect((await service.getLatest(profileId))?.kg).toBe(82.4);
  });

  it('returns trends oldest first within the period', async () => {
    const { service, profileId } = await setup();
    await service.save(profileId, '2025-01-01', 90);
    await service.save(profileId, '2026-08-01', 85);
    await service.save(profileId, '2026-09-20', 84);
    await service.save(profileId, '2026-10-03', 83);
    expect((await service.getTrend(profileId, '1m')).map((e) => e.date)).toEqual([
      '2026-09-20',
      '2026-10-03',
    ]);
    expect((await service.getTrend(profileId, '3m')).map((e) => e.date)).toEqual([
      '2026-08-01',
      '2026-09-20',
      '2026-10-03',
    ]);
    expect(await service.getTrend(profileId, 'all')).toHaveLength(4);
  });

  it('updates and deletes entries', async () => {
    const { db, service, profileId } = await setup();
    const { entry } = await service.save(profileId, '2026-10-03', 82.4);
    const updated = await service.update(profileId, entry.id, 82.1);
    expect(updated.kg).toBe(82.1);
    expect((await service.getForDate(profileId, '2026-10-03'))?.kg).toBe(82.1);

    await service.delete(profileId, entry.id);
    expect(await rowCount(db)).toBe(0);
    await expect(service.delete(profileId, entry.id)).rejects.toEqual(new WeightError('not-found'));
    await expect(service.update(profileId, entry.id, 80)).rejects.toEqual(
      new WeightError('not-found'),
    );
  });

  it('never touches entries of another profile', async () => {
    const { db, service, profileId } = await setup();
    await db.run("INSERT INTO profiles (id, created_at, updated_at) VALUES ('other', 'x', 'x')");
    const { entry } = await service.save('other', '2026-10-03', 70);
    await expect(service.delete(profileId, entry.id)).rejects.toBeInstanceOf(WeightError);
    expect(await service.getHistory(profileId, 10)).toEqual([]);
  });
});

describe('many entries', () => {
  it('pages and filters without loading everything', async () => {
    const { db, service, profileId } = await setup();
    await db.transaction(async (tx) => {
      for (let i = 0; i < 1500; i += 1) {
        const date = new Date(2026, 9, 3 - i);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        await tx.run(
          "INSERT INTO weight_entries (id, profile_id, date, value, created_at, updated_at) VALUES (?, ?, ?, ?, 'x', 'x')",
          [`id-${i}`, profileId, key, 80 + (i % 10) / 10],
        );
      }
    });
    const page = await service.getHistory(profileId, 30);
    expect(page).toHaveLength(30);
    expect(page[0]?.date).toBe('2026-10-03');
    expect((await service.getTrend(profileId, '1y')).length).toBeLessThanOrEqual(366);
    expect(await service.countEntries(profileId)).toBe(1500);
  });
});

describe('weight_entries schema', () => {
  it('rejects out-of-range values and duplicate days at the database level', async () => {
    const { db, profileId } = await setup();
    const insert = (id: string, date: string, value: number) =>
      db.run(
        "INSERT INTO weight_entries (id, profile_id, date, value, created_at, updated_at) VALUES (?, ?, ?, ?, 'x', 'x')",
        [id, profileId, date, value],
      );
    await insert('a', '2026-10-03', 80);
    await expect(insert('b', '2026-10-03', 81)).rejects.toThrow(/UNIQUE/);
    await expect(insert('c', '2026-10-02', 5)).rejects.toThrow(/CHECK/);
    await expect(insert('d', 'today', 80)).rejects.toThrow(/CHECK/);
  });

  it('uses the index for date lookups', async () => {
    const { db, profileId } = await setup();
    const plan = await db.query<{ detail: string }>(
      'EXPLAIN QUERY PLAN SELECT * FROM weight_entries WHERE profile_id = ? ORDER BY date DESC LIMIT 30',
      [profileId],
    );
    expect(plan.map((p) => p.detail).join(' ')).toMatch(/USING INDEX weight_entries_profile_date/);
  });

  it('removes weight entries when the profile is deleted', async () => {
    const { db, service, profileId } = await setup();
    await service.save(profileId, '2026-10-03', 80);
    await db.run('DELETE FROM profiles WHERE id = ?', [profileId]);
    expect(await rowCount(db)).toBe(0);
  });
});
