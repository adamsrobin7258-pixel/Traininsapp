import { createServices } from '@/app/services';
import { migrate, migrations } from '@/core/database';
import { openSqlJsDriver } from '@/core/database/drivers/sqlJs';
import { HealthPlatformError } from '@/core/platform/health';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import { parseConnectionState } from './healthConnectionRepository';
import { dailyTotals, dayWeight, earliestWeightPerDay, syncWindow } from './importedHealth';
import { ImportedHealthRepository } from './importedHealthRepository';

// Saturday, 3 October 2026, 10:00 local time. Window: 4 September – 3 October.
let now = new Date(2026, 9, 3, 10, 0);
const clock = () => now;
const minutes = (n: number) => {
  now = new Date(now.getTime() + n * 60_000);
};

async function setup() {
  now = new Date(2026, 9, 3, 10, 0);
  const db = await createTestDatabase();
  const platform = new FakeHealthPlatform();
  const services = createServices(
    { driver: db, security: ENCRYPTED_TEST_SECURITY },
    clock,
    undefined,
    undefined,
    platform,
  );
  const profile = await services.profile.ensureLocalProfile();
  return { db, platform, services, health: services.healthSync, profileId: profile.id };
}

const weight = (
  day: number,
  hour: number,
  minute: number,
  kg: number,
  id = `w-${day}-${hour}`,
) => ({
  id,
  measuredAt: localIso(2026, 10, day, hour, minute),
  kg,
  source: 'Withings Body+',
});
const total = (month: number, day: number, value: number) => ({
  dayStart: localIso(2026, month, day),
  value,
});

async function storedWeights(db: Awaited<ReturnType<typeof setup>>['db']) {
  return db.query<{ date: string; value: number; external_id: string | null }>(
    'SELECT date, value, external_id FROM imported_weights ORDER BY date',
  );
}

async function storedActivity(db: Awaited<ReturnType<typeof setup>>['db']) {
  return db.query<{ date: string; steps: number | null; active_kcal: number | null }>(
    'SELECT date, steps, active_kcal FROM daily_activity ORDER BY date',
  );
}

describe('imported health domain', () => {
  const window = syncWindow(now);

  it('covers the last 30 local days including today', () => {
    expect(window.fromDate).toBe('2026-09-04');
    expect(window.toDate).toBe('2026-10-03');
    expect(window.start).toBe(localIso(2026, 9, 4));
  });

  it('keeps the earliest measurement of each day', () => {
    const days = earliestWeightPerDay(
      [
        weight(2, 18, 10, 93.1),
        weight(2, 8, 2, 92.4),
        weight(2, 12, 30, 92.8),
        weight(3, 7, 0, 92.0),
      ],
      window,
      now,
    );
    expect(days.map((d) => [d.date, d.kg])).toEqual([
      ['2026-10-02', 92.4],
      ['2026-10-03', 92.0],
    ]);
    expect(days[0]).toMatchObject({ externalId: 'w-2-8', source: 'Withings Body+' });
  });

  it('skips invalid weights so they cannot displace valid ones', () => {
    const days = earliestWeightPerDay(
      [
        weight(2, 6, 0, 8240),
        weight(2, 6, 30, Number.NaN),
        { id: 'x', measuredAt: 'kaputt', kg: 90, source: null },
        weight(2, 9, 0, 91.5),
        weight(3, 23, 0, 90), // in the future
        { ...weight(3, 8, 0, 90.4), measuredAt: localIso(2026, 8, 1, 8) }, // outside the window
      ],
      window,
      now,
    );
    expect(days.map((d) => [d.date, d.kg])).toEqual([['2026-10-02', 91.5]]);
  });

  it('turns daily totals into stored values and drops zero or implausible ones', () => {
    expect(
      dailyTotals(
        [total(10, 1, 8421.6), total(10, 2, 0), total(10, 3, 250_000), total(8, 1, 500)],
        'steps',
        window,
      ),
    ).toEqual([{ date: '2026-10-01', value: 8422 }]);
    expect(dailyTotals([total(10, 2, 412.37)], 'activeEnergy', window)).toEqual([
      { date: '2026-10-02', value: 412.4 },
    ]);
  });

  it('lets the own weight win over an imported one', () => {
    const imported = {
      profileId: 'p',
      platform: 'healthConnect' as const,
      date: '2026-10-02',
      kg: 92.4,
      measuredAt: 'x',
      externalId: null,
      source: null,
    };
    expect(dayWeight(91.0, imported)).toEqual({ kind: 'own', kg: 91.0, imported });
    expect(dayWeight(null, imported)).toEqual({ kind: 'imported', kg: 92.4, imported });
    expect(dayWeight(null, null)).toEqual({ kind: 'none' });
  });

  it('falls back to "not connected" for a corrupt stored state', () => {
    expect(parseConnectionState('nonsense').enabled).toBe(false);
    expect(
      parseConnectionState({ enabled: true, lastResult: 'boom', missing: ['steps', 'x'] }),
    ).toMatchObject({ enabled: true, lastResult: null, missing: ['steps'] });
  });
});

describe('imported health repository', () => {
  const window = syncWindow(now);

  it('saves, updates and removes imported weights only inside the window', async () => {
    const { db, profileId } = await setup();
    const repo = new ImportedHealthRepository(db);
    await db.run(
      `INSERT INTO imported_weights (id, profile_id, platform, date, value, measured_at, created_at, updated_at)
       VALUES ('old', ?, 'healthConnect', '2026-08-01', 95, 'x', 'x', 'x')`,
      [profileId],
    );
    const day = (date: string, kg: number) => ({
      date,
      kg,
      measuredAt: `${date}T06:00:00.000Z`,
      externalId: `id-${date}`,
      source: null,
    });
    await repo.upsertWeights(
      profileId,
      'healthConnect',
      [day('2026-10-01', 92), day('2026-10-02', 91.8)],
      't1',
    );
    await repo.upsertWeights(profileId, 'healthConnect', [day('2026-10-02', 91.5)], 't2');
    expect((await storedWeights(db)).map((r) => [r.date, r.value])).toEqual([
      ['2026-08-01', 95],
      ['2026-10-01', 92],
      ['2026-10-02', 91.5],
    ]);
    // 1 October no longer returned → removed; August (outside the window) stays.
    expect(
      await repo.removeWeightsMissingFrom(profileId, 'healthConnect', window, [
        day('2026-10-02', 91.5),
      ]),
    ).toBe(1);
    expect((await storedWeights(db)).map((r) => r.date)).toEqual(['2026-08-01', '2026-10-02']);
  });

  it('stores steps and active energy independently per day', async () => {
    const { db, profileId } = await setup();
    const repo = new ImportedHealthRepository(db);
    await repo.upsertActivity(
      profileId,
      'healthConnect',
      'steps',
      [{ date: '2026-10-02', value: 9000 }],
      't',
    );
    await repo.upsertActivity(
      profileId,
      'healthConnect',
      'activeEnergy',
      [{ date: '2026-10-02', value: 410 }],
      't',
    );
    await repo.upsertActivity(
      profileId,
      'healthConnect',
      'activeEnergy',
      [{ date: '2026-10-03', value: 120 }],
      't',
    );
    expect(await storedActivity(db)).toEqual([
      { date: '2026-10-02', steps: 9000, active_kcal: 410 },
      { date: '2026-10-03', steps: null, active_kcal: 120 },
    ]);
    await repo.clearActivityMissingFrom(
      profileId,
      'healthConnect',
      'activeEnergy',
      window,
      [],
      't',
    );
    expect(await storedActivity(db)).toEqual([
      { date: '2026-10-02', steps: 9000, active_kcal: null },
    ]);
  });

  it('is removed together with the profile', async () => {
    const { db, profileId } = await setup();
    const repo = new ImportedHealthRepository(db);
    await repo.upsertActivity(
      profileId,
      'healthConnect',
      'steps',
      [{ date: '2026-10-02', value: 9000 }],
      't',
    );
    await repo.upsertWeights(
      profileId,
      'healthConnect',
      [{ date: '2026-10-02', kg: 90, measuredAt: 'x', externalId: null, source: null }],
      't',
    );
    await db.run('DELETE FROM profiles WHERE id = ?', [profileId]);
    expect(await storedWeights(db)).toEqual([]);
    expect(await storedActivity(db)).toEqual([]);
  });

  it('uses the indexes for day and range queries', async () => {
    const { db } = await setup();
    const plan = async (sql: string) =>
      (await db.query<{ detail: string }>(`EXPLAIN QUERY PLAN ${sql}`, ['p', 'a', 'b']))
        .map((r) => r.detail)
        .join(' | ');
    expect(
      await plan('SELECT * FROM imported_weights WHERE profile_id = ? AND date >= ? AND date <= ?'),
    ).toMatch(/USING INDEX imported_weights_/);
    expect(
      await plan('SELECT * FROM daily_activity WHERE profile_id = ? AND date >= ? AND date <= ?'),
    ).toMatch(/USING INDEX (daily_activity_profile_date|sqlite_autoindex_daily_activity)/);
  });
});

describe('health sync service', () => {
  function fill(platform: FakeHealthPlatform) {
    platform.weights = [weight(2, 8, 2, 92.4), weight(2, 12, 30, 92.8), weight(2, 18, 10, 93.1)];
    platform.steps = [total(10, 2, 8421), total(10, 3, 1200)];
    platform.activeEnergy = [total(10, 2, 412)];
  }

  it('is off by default and does nothing without being connected', async () => {
    const { health, platform, profileId, db } = await setup();
    fill(platform);
    expect(await health.status()).toEqual({ state: 'disconnected' });
    expect(await health.sync(profileId, { manual: false })).toEqual({ kind: 'disabled' });
    expect(platform.calls.reads).toBe(0);
    expect(await storedWeights(db)).toEqual([]);
  });

  it('connects after the permission dialog and imports the last 30 days', async () => {
    const { health, platform, profileId, db } = await setup();
    fill(platform);
    expect(await health.connect(profileId)).toEqual({ kind: 'connected', result: 'ok' });
    expect(platform.calls.request).toBe(1);
    expect(platform.ranges[0]).toEqual({ start: localIso(2026, 9, 4), end: now.toISOString() });
    expect(await storedWeights(db)).toEqual([
      { date: '2026-10-02', value: 92.4, external_id: 'w-2-8' },
    ]);
    expect(await storedActivity(db)).toEqual([
      { date: '2026-10-02', steps: 8421, active_kcal: 412 },
      { date: '2026-10-03', steps: 1200, active_kcal: null },
    ]);
    expect(await health.status()).toEqual({
      state: 'connected',
      lastSuccessAt: now.toISOString(),
      lastResult: 'ok',
      missing: [],
    });
  });

  it('stays off when the user grants nothing', async () => {
    const { health, platform, profileId } = await setup();
    platform.grantOnRequest = [];
    expect(await health.connect(profileId)).toEqual({ kind: 'denied' });
    expect(await health.status()).toEqual({ state: 'disconnected' });
  });

  it('explains when Health Connect is missing', async () => {
    const { health, platform, profileId } = await setup();
    platform.available = { kind: 'needsInstall' };
    expect(await health.connect(profileId)).toEqual({ kind: 'unavailable', needsInstall: true });
    expect(await health.status()).toEqual({ state: 'needsInstall' });
    platform.available = { kind: 'unsupported' };
    expect(await health.status()).toEqual({ state: 'unsupported' });
  });

  it('imports what is granted and reports missing permissions', async () => {
    const { health, platform, profileId, db } = await setup();
    fill(platform);
    platform.grantOnRequest = ['weight', 'exercise'];
    expect(await health.connect(profileId)).toEqual({ kind: 'connected', result: 'partial' });
    expect(await storedWeights(db)).toHaveLength(1);
    expect(await storedActivity(db)).toEqual([]);
    expect(await health.status()).toMatchObject({
      state: 'connected',
      lastResult: 'partial',
      missing: ['steps', 'activeEnergy', 'distance'],
    });
  });

  it('throttles automatic syncs to one per 15 minutes; manual syncs always run', async () => {
    const { health, platform, profileId } = await setup();
    fill(platform);
    await health.connect(profileId);
    const reads = platform.calls.reads;
    minutes(10);
    expect(await health.sync(profileId, { manual: false })).toEqual({ kind: 'skipped' });
    expect(platform.calls.reads).toBe(reads);
    expect(await health.sync(profileId, { manual: true })).toEqual({ kind: 'done', result: 'ok' });
    expect(platform.calls.reads).toBe(reads + 4);
    minutes(14);
    expect(await health.sync(profileId, { manual: false })).toEqual({ kind: 'skipped' });
    minutes(2);
    expect(await health.sync(profileId, { manual: false })).toEqual({ kind: 'done', result: 'ok' });
  });

  it('runs one sync at a time', async () => {
    const { health, platform, profileId } = await setup();
    fill(platform);
    await health.connect(profileId);
    const first = health.sync(profileId, { manual: true });
    const second = health.sync(profileId, { manual: true });
    expect(second).toBe(first);
    await first;
  });

  it('re-sync updates changed values, adds new ones and removes deleted ones', async () => {
    const { health, platform, profileId, db } = await setup();
    fill(platform);
    await health.connect(profileId);
    // In Health Connect: the 08:02 weighing was deleted, a new day was added, steps changed.
    platform.weights = [weight(2, 12, 30, 92.8), weight(3, 7, 15, 92.1)];
    platform.steps = [total(10, 2, 9000)];
    platform.activeEnergy = [];
    minutes(20);
    expect(await health.sync(profileId, { manual: false })).toEqual({ kind: 'done', result: 'ok' });
    expect(await storedWeights(db)).toEqual([
      { date: '2026-10-02', value: 92.8, external_id: 'w-2-12' },
      { date: '2026-10-03', value: 92.1, external_id: 'w-3-7' },
    ]);
    expect(await storedActivity(db)).toEqual([
      { date: '2026-10-02', steps: 9000, active_kcal: null },
    ]);
  });

  it('never deletes after a failed or incomplete read', async () => {
    const { health, platform, profileId, db } = await setup();
    fill(platform);
    await health.connect(profileId);
    const before = { weights: await storedWeights(db), activity: await storedActivity(db) };

    // Weights gone in Health Connect, but the steps read fails: nothing may be removed.
    platform.weights = [];
    platform.failures.set('steps', new HealthPlatformError('failed'));
    expect(await health.sync(profileId, { manual: true })).toEqual({
      kind: 'done',
      result: 'failed',
    });
    expect(await storedWeights(db)).toEqual(before.weights);
    expect(await storedActivity(db)).toEqual(before.activity);
    const status = await health.status();
    expect(status).toMatchObject({ state: 'connected', lastResult: 'failed' });
    // The last successful sync is still the first one.
    expect(status).toMatchObject({ lastSuccessAt: new Date(2026, 9, 3, 10, 0).toISOString() });

    // Health Connect unavailable: nothing changes either.
    platform.failures.clear();
    platform.available = { kind: 'unsupported' };
    expect(await health.sync(profileId, { manual: true })).toEqual({
      kind: 'done',
      result: 'unavailable',
    });
    expect(await storedWeights(db)).toEqual(before.weights);
  });

  it('keeps imported data when access is revoked outside Kalethra', async () => {
    const { health, platform, profileId, db } = await setup();
    fill(platform);
    await health.connect(profileId);
    const before = await storedWeights(db);
    platform.granted.clear();
    expect(await health.sync(profileId, { manual: true })).toEqual({
      kind: 'done',
      result: 'permission',
    });
    expect(await health.status()).toMatchObject({ state: 'permissionRequired' });
    expect(await storedWeights(db)).toEqual(before);
    expect(await storedActivity(db)).not.toEqual([]);
  });

  it('keeps everything when a read reports a revoked permission mid-sync', async () => {
    const { health, platform, profileId, db } = await setup();
    fill(platform);
    await health.connect(profileId);
    platform.weights = [];
    platform.failures.set('weight', new HealthPlatformError('permission'));
    expect(await health.sync(profileId, { manual: true })).toEqual({
      kind: 'done',
      result: 'partial',
    });
    expect(await storedWeights(db)).toHaveLength(1);
  });

  it('disconnects and deletes only the imported data', async () => {
    const { health, platform, profileId, db, services } = await setup();
    fill(platform);
    await services.weight.save(profileId, '2026-10-01', 90.5);
    await health.connect(profileId);
    await health.disconnect(profileId, { deleteImported: true });
    expect(await health.status()).toEqual({ state: 'disconnected' });
    expect(await storedWeights(db)).toEqual([]);
    expect(await storedActivity(db)).toEqual([]);
    expect((await services.weight.getForDate(profileId, '2026-10-01'))?.kg).toBe(90.5);
    expect(await health.sync(profileId, { manual: true })).toEqual({ kind: 'disabled' });
  });

  it('disconnects and keeps the imported data when asked to', async () => {
    const { health, platform, profileId, db } = await setup();
    fill(platform);
    await health.connect(profileId);
    await health.disconnect(profileId, { deleteImported: false });
    expect(await health.status()).toEqual({ state: 'disconnected' });
    expect(await storedWeights(db)).toHaveLength(1);
    expect(await storedActivity(db)).toHaveLength(2);
  });
});

describe('imported data and nutrition goals', () => {
  it('an imported Health Connect weight never changes weight entries or nutrition goals', async () => {
    const { health, platform, profileId, services, db } = await setup();
    await services.profile.updateBodyData(await services.profile.ensureLocalProfile(), {
      sex: 'male',
      birthDate: '1990-05-01',
      heightCm: 180,
    });
    for (let day = 27; day <= 30; day++)
      await services.weight.save(profileId, `2026-09-${String(day)}`, 90);
    await services.weight.save(profileId, '2026-10-03', 90);
    const goal = await services.nutrition.goals.saveProfile(profileId, {
      params: {
        goalType: 'lose',
        goalLevel: 'moderate',
        activityLevel: 'moderate',
        includeTraining: false,
        targetWeightKg: 82,
      },
      overrides: {},
      waterMl: 2500,
    });
    const entriesBefore = await db.query('SELECT * FROM weight_entries ORDER BY date');

    // Health Connect reports a very different weight every day (and lots of activity).
    platform.weights = Array.from({ length: 7 }, (_, i) =>
      weight(3 - i > 0 ? 3 - i : 1, 7, 0, 120, `hc-${String(i)}`),
    );
    platform.steps = [total(10, 3, 25_000)];
    platform.activeEnergy = [total(10, 3, 1800)];
    expect(await health.connect(profileId)).toEqual({ kind: 'connected', result: 'ok' });
    expect((await storedWeights(db)).length).toBeGreaterThan(0);

    expect(await services.nutrition.goals.refreshAutomatic(profileId)).toBe('unchanged');
    const after = await services.nutrition.goals.goalFor(profileId, '2026-10-03');
    expect(after?.goal.id).toBe(goal.id);
    expect(after?.goal.targets.energyKcal).toEqual(goal.targets.energyKcal);
    expect(after?.goal.calculation?.inputs.weight).toMatchObject({ kg: 90 });
    expect(await db.query('SELECT * FROM weight_entries ORDER BY date')).toEqual(entriesBefore);
    expect(await services.bodyWeight.latestKgOnOrBefore(profileId, '2026-10-03')).toBe(90);
  });
});

describe('migration 10', () => {
  it('adds the import tables and keeps every existing row', async () => {
    const db = await openSqlJsDriver();
    await migrate(db, migrations.slice(0, 9));
    await db.execute(`
      INSERT INTO profiles (id, created_at, updated_at) VALUES ('p', 'x', 'x');
      INSERT INTO weight_entries (id, profile_id, date, value, created_at, updated_at)
        VALUES ('w', 'p', '2026-10-01', 82.4, 'x', 'x');
      INSERT INTO app_settings (key, value, updated_at) VALUES ('theme', '"dark"', 'x');
    `);
    expect(await migrate(db, migrations)).toEqual([10, 11, 12, 13, 14]);
    expect(await db.query('SELECT id, value FROM weight_entries')).toEqual([
      { id: 'w', value: 82.4 },
    ]);
    expect(await db.query('SELECT key, value FROM app_settings')).toEqual([
      { key: 'theme', value: '"dark"' },
    ]);
    expect(await db.query('SELECT * FROM imported_weights')).toEqual([]);
    expect(await db.query('SELECT * FROM daily_activity')).toEqual([]);
    await expect(
      db.run(
        `INSERT INTO imported_weights (id, profile_id, platform, date, value, measured_at, created_at, updated_at)
         VALUES ('i', 'p', 'healthConnect', '2026-10-01', 8240, 'x', 'x', 'x')`,
      ),
    ).rejects.toThrow(/CHECK/);
    expect(await migrate(db, migrations)).toEqual([]);
  });
});
