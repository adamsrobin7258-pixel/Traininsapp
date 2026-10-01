import { createServices } from '@/app/services';
import { migrate, migrations } from '@/core/database';
import { openSqlJsDriver } from '@/core/database/drivers/sqlJs';
import { de } from '@/core/i18n/locales/de';
import { en } from '@/core/i18n/locales/en';
import { HealthPlatformError, type HealthWorkout } from '@/core/platform/health';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import {
  activityCategory,
  countableActivityCalories,
  importableWorkouts,
  isSameSession,
  NAMED_ACTIVITY_TYPES,
  readableActivityType,
  type ExternalWorkoutDraft,
} from './externalWorkouts';
import { syncWindow } from './importedHealth';
import { ImportedHealthRepository } from './importedHealthRepository';

// Saturday, 3 October 2026, 10:00 local time. Window: 4 September – 3 October.
let now = new Date(2026, 9, 3, 10, 0);
const clock = () => now;

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

/** A Health Connect exercise session on a day of October 2026. */
function session(
  id: string,
  day: number,
  [hour, minute]: [number, number],
  minutes: number,
  extra: Partial<HealthWorkout> = {},
): HealthWorkout {
  const start = localIso(2026, 10, day, hour, minute);
  return {
    id,
    type: 'running',
    start,
    end: new Date(Date.parse(start) + minutes * 60_000).toISOString(),
    activeKcal: 386,
    distanceM: 5800,
    source: 'Pixel Watch',
    ...extra,
  };
}

function draft(id: string, localDate: string, extra: Partial<ExternalWorkoutDraft> = {}) {
  return {
    externalId: id,
    activityType: 'running',
    category: 'endurance' as const,
    startedAt: `${localDate}T16:20:00.000Z`,
    endedAt: `${localDate}T17:02:00.000Z`,
    localDate,
    durationS: 42 * 60,
    activeKcal: 386,
    distanceM: 5800,
    steps: null,
    source: 'Pixel Watch',
    ...extra,
  };
}

async function stored(db: Awaited<ReturnType<typeof setup>>['db']) {
  return db.query<{
    external_id: string;
    activity_type: string;
    local_date: string;
    duration_s: number;
    active_kcal: number | null;
    distance_m: number | null;
  }>(
    `SELECT external_id, activity_type, local_date, duration_s, active_kcal, distance_m
     FROM external_workouts ORDER BY started_at`,
  );
}

describe('activity types', () => {
  it('maps known Health Connect types to a category and leaves unknown ones as "other"', () => {
    expect(activityCategory('running')).toBe('endurance');
    expect(activityCategory('strengthTraining')).toBe('strength');
    expect(activityCategory('yoga')).toBe('flexibility');
    expect(activityCategory('soccer')).toBe('sport');
    expect(activityCategory('highIntensityIntervalTraining')).toBe('hybrid');
    expect(activityCategory('frisbeeDisc')).toBe('other');
    expect(activityCategory('other')).toBe('other');
  });

  it('has a German and an English name for every named type and for "other"', () => {
    for (const type of [...NAMED_ACTIVITY_TYPES, 'other']) {
      const deName = (de.activities.types as Record<string, string>)[type];
      const enName = (en.activities.types as Record<string, string>)[type];
      expect(deName, type).toBeTruthy();
      expect(enName, type).toBeTruthy();
    }
    expect(de.activities.types.running).toBe('Laufen');
    expect(en.activities.types.running).toBe('Running');
  });

  it('shows an unknown provider type by its own name instead of guessing another sport', () => {
    expect(readableActivityType('frisbeeDisc')).toBe('Frisbee disc');
    expect(readableActivityType('paragliding')).toBe('Paragliding');
    expect(readableActivityType('water_polo')).toBe('Water polo');
  });
});

describe('importable activities', () => {
  const window = syncWindow(now);

  it('keeps valid sessions with their local day, duration and optional values', () => {
    const result = importableWorkouts(
      [
        session('b', 3, [7, 0], 30, { type: 'yoga', activeKcal: null, distanceM: null }),
        session('a', 2, [18, 20], 42),
      ],
      window,
      now,
    );
    expect(result).toEqual([
      expect.objectContaining({
        externalId: 'a',
        activityType: 'running',
        category: 'endurance',
        localDate: '2026-10-02',
        durationS: 42 * 60,
        activeKcal: 386,
        distanceM: 5800,
        steps: null,
        source: 'Pixel Watch',
      }),
      // No energy or distance reported: stays empty, never an invented 0.
      expect.objectContaining({
        externalId: 'b',
        category: 'flexibility',
        activeKcal: null,
        distanceM: null,
      }),
    ]);
  });

  it('skips sessions without ID, with an end before the start, over 24 h, in the future or outside 30 days', () => {
    const result = importableWorkouts(
      [
        session('', 2, [8, 0], 30),
        { ...session('reverse', 2, [8, 0], 30), end: localIso(2026, 10, 2, 7, 0) },
        session('long', 1, [8, 0], 25 * 60),
        session('future', 3, [11, 0], 30),
        {
          ...session('old', 1, [8, 0], 30),
          start: localIso(2026, 9, 3, 8),
          end: localIso(2026, 9, 3, 9),
        },
        session('ok', 3, [8, 0], 30),
      ],
      window,
      now,
    );
    expect(result.map((w) => w.externalId)).toEqual(['ok']);
  });

  it('drops implausible energy or distance but keeps the session, and lists each ID once', () => {
    const result = importableWorkouts(
      [
        session('a', 2, [8, 0], 30, { activeKcal: -5, distanceM: 2_000_000 }),
        session('a', 2, [8, 0], 30, { activeKcal: 250.4, distanceM: 4200.6 }),
      ],
      window,
      now,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ activeKcal: 250, distanceM: 4201 });
    const broken = importableWorkouts(
      [session('x', 2, [8, 0], 30, { activeKcal: Number.NaN, distanceM: -1 })],
      window,
      now,
    );
    expect(broken[0]).toMatchObject({ activeKcal: null, distanceM: null });
  });
});

describe('same session as a Kalethra workout', () => {
  const span = (from: [number, number], to: [number, number]) => ({
    startedAt: localIso(2026, 10, 2, ...from),
    endedAt: localIso(2026, 10, 2, ...to),
  });

  it('counts sessions overlapping at least half of the shorter one as the same', () => {
    const gym = span([18, 0], [19, 0]);
    expect(isSameSession(span([18, 5], [19, 2]), gym)).toBe(true);
    expect(isSameSession(span([18, 30], [19, 30]), gym)).toBe(true);
    expect(isSameSession(span([18, 45], [19, 45]), gym)).toBe(false);
    expect(isSameSession(span([19, 0], [19, 40]), gym)).toBe(false);
    expect(isSameSession(span([7, 0], [7, 40]), gym)).toBe(false);
  });

  it('adds up the energy of the other activities and reports the excluded ones', () => {
    const activity = (from: [number, number], to: [number, number], kcal: number | null) => ({
      ...span(from, to),
      activeKcal: kcal,
    });
    expect(
      countableActivityCalories(
        [
          activity([7, 0], [7, 42], 386.4),
          activity([12, 0], [12, 30], null),
          activity([18, 2], [18, 58], 410),
          activity([20, 0], [20, 20], 114.3),
        ],
        [span([18, 0], [19, 0])],
      ),
    ).toEqual({ kcal: 501, counted: 2, excluded: 1 });
    expect(countableActivityCalories([], [])).toEqual({ kcal: 0, counted: 0, excluded: 0 });
  });
});

describe('external workouts repository', () => {
  const window = syncWindow(now);

  it('saves, updates by record ID and removes only inside the window', async () => {
    const { db, profileId } = await setup();
    const repo = new ImportedHealthRepository(db);
    await repo.upsertWorkouts(
      profileId,
      'healthConnect',
      [draft('old', '2026-08-01'), draft('a', '2026-10-01'), draft('b', '2026-10-02')],
      't1',
    );
    await repo.upsertWorkouts(
      profileId,
      'healthConnect',
      [draft('b', '2026-10-02', { activeKcal: 400, distanceM: null })],
      't2',
    );
    expect((await stored(db)).map((r) => [r.external_id, r.active_kcal, r.distance_m])).toEqual([
      ['old', 386, 5800],
      ['a', 386, 5800],
      ['b', 400, null],
    ]);
    expect(
      await repo.removeWorkoutsMissingFrom(profileId, 'healthConnect', window, [
        draft('b', '2026-10-02'),
      ]),
    ).toBe(1);
    expect((await stored(db)).map((r) => r.external_id)).toEqual(['old', 'b']);
  });

  it('lists newest first, finds one and counts as imported data', async () => {
    const { db, profileId } = await setup();
    const repo = new ImportedHealthRepository(db);
    expect(await repo.hasData(profileId)).toBe(false);
    await repo.upsertWorkouts(
      profileId,
      'healthConnect',
      [draft('a', '2026-09-30'), draft('b', '2026-10-02', { activityType: 'frisbeeDisc' })],
      't',
    );
    const recent = await repo.recentWorkouts(profileId, 10);
    expect(recent.map((w) => w.externalId)).toEqual(['b', 'a']);
    expect(recent[0]).toMatchObject({ activityType: 'frisbeeDisc', category: 'other' });
    expect((await repo.listWorkouts(profileId, '2026-10-01', '2026-10-03')).length).toBe(1);
    expect(await repo.findWorkout(profileId, recent[1]!.id)).toMatchObject({ externalId: 'a' });
    expect(await repo.findWorkout('someone-else', recent[1]!.id)).toBeNull();
    expect(await repo.hasData(profileId)).toBe(true);
  });

  it('rejects impossible values and duplicate record IDs', async () => {
    const { db, profileId } = await setup();
    const insert = (id: string, externalId: string, duration: number, kcal: number | null) =>
      db.run(
        `INSERT INTO external_workouts (id, profile_id, platform, external_id, activity_type,
           category, started_at, ended_at, local_date, duration_s, active_kcal, created_at, updated_at)
         VALUES (?, ?, 'healthConnect', ?, 'running', 'endurance', 'x', 'x', '2026-10-02', ?, ?, 'x', 'x')`,
        [id, profileId, externalId, duration, kcal],
      );
    await insert('1', 'r1', 60, 100);
    await expect(insert('2', 'r1', 60, 100)).rejects.toThrow(/UNIQUE/);
    await expect(insert('3', 'r3', 0, 100)).rejects.toThrow(/CHECK/);
    await expect(insert('4', 'r4', 60, -1)).rejects.toThrow(/CHECK/);
  });

  it('is removed together with the profile', async () => {
    const { db, profileId } = await setup();
    await new ImportedHealthRepository(db).upsertWorkouts(
      profileId,
      'healthConnect',
      [draft('a', '2026-10-02')],
      't',
    );
    await db.run('DELETE FROM profiles WHERE id = ?', [profileId]);
    expect(await stored(db)).toEqual([]);
  });

  it('uses the indexes for list, day and record queries', async () => {
    const { db } = await setup();
    const plan = async (sql: string, params: string[]) =>
      (await db.query<{ detail: string }>(`EXPLAIN QUERY PLAN ${sql}`, params))
        .map((r) => r.detail)
        .join(' | ');
    expect(
      await plan('SELECT * FROM external_workouts WHERE profile_id = ? ORDER BY started_at DESC', [
        'p',
      ]),
    ).toMatch(/USING INDEX external_workouts_profile_start/);
    expect(
      await plan(
        'SELECT * FROM external_workouts WHERE profile_id = ? AND local_date BETWEEN ? AND ?',
        ['p', 'a', 'b'],
      ),
    ).toMatch(/USING INDEX external_workouts_profile_date/);
    expect(
      await plan(
        'SELECT * FROM external_workouts WHERE profile_id = ? AND platform = ? AND external_id = ?',
        ['p', 'healthConnect', 'x'],
      ),
    ).toMatch(/USING INDEX external_workouts_record/);
  });
});

describe('activity sync', () => {
  it('imports the activities of the last 30 days on connect', async () => {
    const { db, health, platform, profileId } = await setup();
    platform.workouts = [
      session('a', 2, [18, 20], 42),
      session('b', 3, [7, 0], 30, { type: 'frisbeeDisc', activeKcal: null, distanceM: null }),
      {
        ...session('old', 1, [8, 0], 30),
        start: localIso(2026, 8, 1, 8),
        end: localIso(2026, 8, 1, 9),
      },
    ];
    expect(await health.connect(profileId)).toEqual({ kind: 'connected', result: 'ok' });
    expect(platform.ranges.every((range) => range.start === localIso(2026, 9, 4))).toBe(true);
    expect(await stored(db)).toEqual([
      {
        external_id: 'a',
        activity_type: 'running',
        local_date: '2026-10-02',
        duration_s: 2520,
        active_kcal: 386,
        distance_m: 5800,
      },
      {
        external_id: 'b',
        activity_type: 'frisbeeDisc',
        local_date: '2026-10-03',
        duration_s: 1800,
        active_kcal: null,
        distance_m: null,
      },
    ]);
  });

  it('updates changed, adds new and removes deleted activities without duplicates', async () => {
    const { db, health, platform, profileId } = await setup();
    platform.workouts = [session('a', 2, [18, 20], 42), session('b', 3, [7, 0], 30)];
    await health.connect(profileId);
    platform.workouts = [
      session('a', 2, [18, 20], 45, { activeKcal: 402 }),
      session('c', 3, [8, 0], 20, { type: 'walking' }),
    ];
    await health.sync(profileId, { manual: true });
    await health.sync(profileId, { manual: true });
    expect((await stored(db)).map((r) => [r.external_id, r.duration_s, r.active_kcal])).toEqual([
      ['a', 2700, 402],
      ['c', 1200, 386],
    ]);
  });

  it('never deletes activities after a failed or incomplete read', async () => {
    const { db, health, platform, profileId } = await setup();
    platform.workouts = [session('a', 2, [18, 20], 42), session('b', 3, [7, 0], 30)];
    await health.connect(profileId);
    platform.workouts = [];

    platform.failures.set('exercise', new HealthPlatformError('failed'));
    expect(await health.sync(profileId, { manual: true })).toEqual({
      kind: 'done',
      result: 'failed',
    });
    expect(await stored(db)).toHaveLength(2);

    // Activities read fine, but steps failed: incomplete → nothing is removed.
    platform.failures.clear();
    platform.failures.set('steps', new HealthPlatformError('failed'));
    await health.sync(profileId, { manual: true });
    expect(await stored(db)).toHaveLength(2);

    // Access to activities revoked: kept, reported as missing.
    platform.failures.clear();
    platform.granted.delete('exercise');
    expect(await health.sync(profileId, { manual: true })).toEqual({
      kind: 'done',
      result: 'partial',
    });
    expect(await stored(db)).toHaveLength(2);
    expect(await health.status()).toMatchObject({ missing: ['exercise'] });

    // Complete successful read: the deleted sessions disappear.
    platform.granted.add('exercise');
    await health.sync(profileId, { manual: true });
    expect(await stored(db)).toEqual([]);
  });

  it('reports a missing distance permission without blocking the activities', async () => {
    const { db, health, platform, profileId } = await setup();
    platform.workouts = [session('a', 2, [18, 20], 42, { activeKcal: null, distanceM: null })];
    platform.grantOnRequest = ['weight', 'steps', 'activeEnergy', 'exercise'];
    expect(await health.connect(profileId)).toEqual({ kind: 'connected', result: 'partial' });
    expect(await stored(db)).toHaveLength(1);
    expect(await health.status()).toMatchObject({ missing: ['distance'] });

    // "Fehlende Berechtigungen erteilen" asks again and syncs.
    platform.grantOnRequest = ['weight', 'steps', 'activeEnergy', 'exercise', 'distance'];
    platform.workouts = [session('a', 2, [18, 20], 42)];
    expect(await health.requestMissingAccess(profileId)).toEqual({ kind: 'done', result: 'ok' });
    expect((await stored(db))[0]).toMatchObject({ active_kcal: 386, distance_m: 5800 });
  });

  it('disconnecting deletes imported activities but never Kalethra workouts', async () => {
    const { db, health, platform, profileId, services } = await setup();
    const own = await services.training.workouts.startFree(profileId);
    await services.training.workouts.finish(profileId, own.id);
    platform.workouts = [session('a', 2, [18, 20], 42)];
    await health.connect(profileId);
    await health.disconnect(profileId, { deleteImported: true });
    expect(await stored(db)).toEqual([]);
    expect(await db.query("SELECT id FROM workouts WHERE status = 'completed'")).toEqual([
      { id: own.id },
    ]);
  });

  it('keeps imported activities when disconnecting without deleting', async () => {
    const { db, health, platform, profileId } = await setup();
    platform.workouts = [session('a', 2, [18, 20], 42)];
    await health.connect(profileId);
    await health.disconnect(profileId, { deleteImported: false });
    expect(await stored(db)).toHaveLength(1);
  });

  it('never adds imported activities to Kalethra workouts, history or plan progress', async () => {
    const { health, platform, profileId, services } = await setup();
    platform.workouts = [session('a', 2, [18, 20], 42), session('b', 3, [7, 0], 30)];
    await health.connect(profileId);
    const training = services.training;
    expect(await training.workouts.getHistory(profileId, { limit: 10 })).toEqual([]);
    expect(await training.workouts.overview(profileId)).toEqual({
      last: null,
      last7Days: 0,
      last30Days: 0,
    });
    expect(await training.workouts.completedBetween(profileId, '2026-09-01', '2026-10-03')).toEqual(
      [],
    );
  });
});

describe('migration 11', () => {
  it('adds the activities table and keeps every existing row', async () => {
    const db = await openSqlJsDriver();
    await migrate(db, migrations.slice(0, 10));
    await db.execute(`
      INSERT INTO profiles (id, created_at, updated_at) VALUES ('p', 'x', 'x');
      INSERT INTO weight_entries (id, profile_id, date, value, created_at, updated_at)
        VALUES ('w', 'p', '2026-10-01', 82.4, 'x', 'x');
      INSERT INTO daily_activity (profile_id, platform, date, steps, active_kcal, created_at, updated_at)
        VALUES ('p', 'healthConnect', '2026-10-01', 9000, 410, 'x', 'x');
    `);
    expect(await migrate(db, migrations)).toEqual([11]);
    expect(await db.query('SELECT id, value FROM weight_entries')).toEqual([
      { id: 'w', value: 82.4 },
    ]);
    expect(await db.query('SELECT steps, active_kcal FROM daily_activity')).toEqual([
      { steps: 9000, active_kcal: 410 },
    ]);
    expect(await db.query('SELECT * FROM external_workouts')).toEqual([]);
    expect(await migrate(db, migrations)).toEqual([]);
  });
});
