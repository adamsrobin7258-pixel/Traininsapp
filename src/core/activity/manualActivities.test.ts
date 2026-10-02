import { createServices } from '@/app/services';
import { migrate, migrations } from '@/core/database';
import { openSqlJsDriver } from '@/core/database/drivers/sqlJs';
import type { HealthWorkout } from '@/core/platform/health';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import { combineActivities, dayActivityCalories, summarizeAllActivities } from './combined';
import { ActivityError, type ManualActivityInput } from './manualActivity';

// Saturday, 3 October 2026, 10:00 local time.
let now = new Date(2026, 9, 3, 10);
const clock = () => now;
const WEEK = [
  '2026-09-27',
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
];

async function setup(db?: Awaited<ReturnType<typeof createTestDatabase>>) {
  now = new Date(2026, 9, 3, 10);
  const database = db ?? (await createTestDatabase());
  const platform = new FakeHealthPlatform();
  const services = createServices(
    { driver: database, security: ENCRYPTED_TEST_SECURITY },
    clock,
    undefined,
    undefined,
    platform,
  );
  const profileId = (await services.profile.ensureLocalProfile()).id;
  return { db: database, platform, services, profileId, activities: services.activities };
}

const input = (extra: Partial<ManualActivityInput> = {}): ManualActivityInput => ({
  sportId: 'tennis',
  localDate: '2026-10-03',
  startTime: '08:00',
  durationMin: 90,
  distanceKm: null,
  intensity: null,
  variant: 'singles',
  kcalOverride: null,
  ...extra,
});

function hc(
  id: string,
  type: string,
  [h, m]: [number, number],
  minutes: number,
  kcal: number | null,
) {
  const start = localIso(2026, 10, 3, h, m);
  return {
    id,
    type,
    start,
    end: new Date(Date.parse(start) + minutes * 60_000).toISOString(),
    activeKcal: kcal,
    distanceM: null,
    source: 'Watch',
  } satisfies HealthWorkout;
}

describe('manual activities: data', () => {
  it('creates an activity with the calculated calories and everything used for them', async () => {
    const { activities, services, profileId } = await setup();
    await services.weight.save(profileId, '2026-10-01', 80);
    const created = await activities.create(profileId, input());
    expect(created).toMatchObject({
      sportId: 'tennis',
      localDate: '2026-10-03',
      startedAt: localIso(2026, 10, 3, 8, 0),
      durationS: 5400,
      distanceM: null,
      intensity: null,
      variant: 'singles',
      weightKg: 80,
      met: 8.0,
      metBasis: 'specific',
      calcMethod: 'met-net-v1',
      calculatedKcal: 882,
      kcal: 882,
      kcalOverridden: false,
    });
    expect(created.metRef).toContain('tennis, singles');
    expect(await activities.get(profileId, created.id)).toEqual(created);
  });

  it('stores a manual change of the calories next to the calculated value', async () => {
    const { activities, services, profileId } = await setup();
    await services.weight.save(profileId, '2026-10-03', 80);
    const created = await activities.create(profileId, input({ kcalOverride: 900 }));
    expect(created).toMatchObject({ calculatedKcal: 882, kcal: 900, kcalOverridden: true });
  });

  it('recalculates on edit and keeps or drops the own value as chosen', async () => {
    const { activities, services, profileId } = await setup();
    await services.weight.save(profileId, '2026-10-03', 80);
    const created = await activities.create(profileId, input({ kcalOverride: 900 }));
    now = new Date(2026, 9, 3, 11);
    const edited = await activities.update(
      profileId,
      created.id,
      input({ durationMin: 60, variant: 'doubles', kcalOverride: 950 }),
    );
    expect(edited).toMatchObject({
      id: created.id,
      createdAt: created.createdAt,
      durationS: 3600,
      met: 6.0,
      calculatedKcal: 420,
      kcal: 950,
      kcalOverridden: true,
    });
    expect(edited.updatedAt).not.toBe(created.updatedAt);
    const auto = await activities.update(profileId, created.id, input({ durationMin: 60 }));
    expect(auto).toMatchObject({ calculatedKcal: 588, kcal: 588, kcalOverridden: false });
  });

  it('keeps optional fields empty and drops fields the sport does not ask for', async () => {
    const { activities, services, profileId } = await setup();
    await services.weight.save(profileId, '2026-10-03', 70);
    const yoga = await activities.create(
      profileId,
      input({
        sportId: 'yoga',
        startTime: null,
        distanceKm: 5,
        variant: 'singles',
        intensity: null,
      }),
    );
    expect(yoga).toMatchObject({
      startedAt: null,
      distanceM: null,
      variant: null,
      intensity: null,
      met: 2.5,
    });
  });

  it('calculates nothing without a body weight, but the own value can be entered', async () => {
    const { activities, profileId } = await setup();
    expect(await activities.create(profileId, input())).toMatchObject({
      weightKg: null,
      calculatedKcal: null,
      kcal: null,
    });
    expect(await activities.create(profileId, input({ kcalOverride: 600 }))).toMatchObject({
      calculatedKcal: null,
      kcal: 600,
      kcalOverridden: true,
    });
  });

  it('uses the most recent body weight: own entry, else a newer Health Connect value', async () => {
    const { activities, services, platform, profileId } = await setup();
    await services.weight.save(profileId, '2026-09-20', 90);
    platform.weights = [{ id: 'w', measuredAt: localIso(2026, 10, 1, 7), kg: 86, source: 'Waage' }];
    await services.healthSync.connect(profileId);
    expect(await activities.weightOn(profileId, '2026-10-03')).toEqual({
      kg: 86,
      date: '2026-10-01',
      source: 'imported',
    });
    // An own entry of the same or a later day wins.
    await services.weight.save(profileId, '2026-10-01', 85);
    expect(await activities.weightOn(profileId, '2026-10-03')).toEqual({
      kg: 85,
      date: '2026-10-01',
      source: 'own',
    });
    // Never a value from after the activity.
    expect(await activities.weightOn(profileId, '2026-09-25')).toEqual({
      kg: 90,
      date: '2026-09-20',
      source: 'own',
    });
    // The nutrition goals keep reading only the own entries.
    expect(await services.bodyWeight.latestKgOnOrBefore(profileId, '2026-10-03')).toBe(85);
  });

  it('validates the input', async () => {
    const { activities, profileId } = await setup();
    const code = (promise: Promise<unknown>) =>
      promise.then(
        () => 'ok',
        (error: unknown) => (error instanceof ActivityError ? error.code : String(error)),
      );
    expect(await code(activities.create(profileId, input({ sportId: 'quidditch' })))).toBe(
      'invalid-sport',
    );
    expect(await code(activities.create(profileId, input({ localDate: '2026-10-04' })))).toBe(
      'future-date',
    );
    expect(await code(activities.create(profileId, input({ durationMin: 0 })))).toBe(
      'invalid-duration',
    );
    expect(await code(activities.create(profileId, input({ durationMin: 1441 })))).toBe(
      'invalid-duration',
    );
    expect(await code(activities.create(profileId, input({ sportId: 'jog', distanceKm: 0 })))).toBe(
      'invalid-distance',
    );
    expect(await code(activities.create(profileId, input({ kcalOverride: 10001 })))).toBe(
      'invalid-kcal',
    );
    expect(await code(activities.create(profileId, input({ kcalOverride: 12.5 })))).toBe(
      'invalid-kcal',
    );
    expect(await code(activities.create(profileId, input({ startTime: '25:00' })))).toBe(
      'invalid-time',
    );
    expect(await code(activities.get(profileId, 'missing'))).toBe('not-found');
    expect(await code(activities.delete(profileId, 'missing'))).toBe('not-found');
  });

  it('lists by day, deletes, and is removed with the profile', async () => {
    const { db, activities, profileId } = await setup();
    const a = await activities.create(profileId, input({ localDate: '2026-10-01' }));
    const b = await activities.create(profileId, input({ localDate: '2026-10-03' }));
    expect(
      (await activities.listBetween(profileId, '2026-10-02', '2026-10-03')).map((x) => x.id),
    ).toEqual([b.id]);
    expect((await activities.recent(profileId)).map((x) => x.id)).toEqual([b.id, a.id]);
    await activities.delete(profileId, b.id);
    expect((await activities.recent(profileId)).map((x) => x.id)).toEqual([a.id]);
    await db.run('DELETE FROM profiles WHERE id = ?', [profileId]);
    expect(await db.query('SELECT * FROM manual_activities')).toEqual([]);
  });

  it('never becomes a Kalethra workout or a Health Connect activity', async () => {
    const { db, activities, services, profileId } = await setup();
    await activities.create(profileId, input({ sportId: 'hiit', variant: null }));
    expect(await db.query('SELECT * FROM workouts')).toEqual([]);
    expect(await db.query('SELECT * FROM external_workouts')).toEqual([]);
    expect(await services.healthSync.recentWorkouts(profileId)).toEqual([]);
    expect(await services.training.workouts.getHistory(profileId, { limit: 10 })).toEqual([]);
  });
});

describe('manual activities: Health Connect and calorie budget', () => {
  it('recognises the same session from Health Connect conservatively', async () => {
    const { activities, services, platform, profileId } = await setup();
    await services.weight.save(profileId, '2026-10-03', 80);
    platform.workouts = [hc('t', 'tennis', [8, 5], 85, 700), hc('r', 'running', [8, 0], 90, 900)];
    await services.healthSync.connect(profileId);
    const imported = await services.healthSync.recentWorkouts(profileId);
    const same = await activities.create(profileId, input());
    // Same time, other sport (running ≠ tennis): no match – but the tennis import matches.
    const noTime = await activities.create(profileId, input({ startTime: null }));
    const shorter = await activities.create(profileId, input({ durationMin: 30 }));
    const later = await activities.create(profileId, input({ startTime: '09:00' }));
    const entries = combineActivities(imported, [same, noTime, shorter, later]);
    const dup = (id: string) =>
      entries.find((e) => e.source === 'manual' && e.activity.id === id && e.duplicateOf);
    expect(dup(same.id)).toBeTruthy();
    // Without a start time, with very different duration or barely overlapping: separate.
    expect(dup(noTime.id)).toBeUndefined();
    expect(dup(shorter.id)).toBeUndefined();
    expect(dup(later.id)).toBeUndefined();
  });

  it('adds 100 % of the countable activity calories – Health Connect value first, no double count', () => {
    const imported = [
      {
        id: 'hc1',
        profileId: 'p',
        platform: 'healthConnect' as const,
        externalId: 'x',
        activityType: 'tennis',
        category: 'sport' as const,
        startedAt: localIso(2026, 10, 3, 8, 5),
        endedAt: localIso(2026, 10, 3, 9, 30),
        localDate: '2026-10-03',
        durationS: 85 * 60,
        activeKcal: 700,
        distanceM: null,
        steps: null,
        source: 'Watch',
      },
    ];
    const manual = (id: string, start: string | null, kcal: number | null) => ({
      id,
      profileId: 'p',
      sportId: 'tennis',
      localDate: '2026-10-03',
      startedAt: start,
      durationS: 90 * 60,
      distanceM: null,
      intensity: null,
      variant: 'singles' as const,
      weightKg: 80,
      met: 8,
      metRef: 'x',
      metBasis: 'specific' as const,
      calcMethod: 'met-net-v1',
      calculatedKcal: 650,
      kcal,
      kcalOverridden: kcal !== 650,
      createdAt: 'x',
      updatedAt: 'x',
    });
    // The manual tennis at 08:00 duplicates the import: only the Health Connect 700 count.
    expect(dayActivityCalories(imported, [manual('a', localIso(2026, 10, 3, 8), 650)], [])).toEqual(
      {
        kcal: 700,
        counted: 1,
        excluded: 1,
      },
    );
    // An own value (700 instead of 650) is what counts.
    expect(dayActivityCalories([], [manual('a', null, 700), manual('b', null, 500)], [])).toEqual({
      kcal: 1200,
      counted: 2,
      excluded: 0,
    });
    // A manual activity during a completed Kalethra workout does not count.
    expect(
      dayActivityCalories(
        [],
        [manual('a', localIso(2026, 10, 3, 8), 650)],
        [{ startedAt: localIso(2026, 10, 3, 8), endedAt: localIso(2026, 10, 3, 9) }],
      ),
    ).toEqual({ kcal: 0, counted: 0, excluded: 1 });
    // Without calories it counts nothing – no invented 0 either.
    expect(dayActivityCalories([], [manual('a', null, null)], [])).toEqual({
      kcal: 0,
      counted: 0,
      excluded: 0,
    });
  });

  it('summarises both sources for the progress page without counting a duplicate twice', async () => {
    const { activities, services, platform, profileId } = await setup();
    await services.weight.save(profileId, '2026-09-30', 80);
    platform.workouts = [hc('t', 'tennis', [8, 5], 85, 700), hc('r', 'running', [6, 0], 40, 400)];
    await services.healthSync.connect(profileId);
    await activities.create(profileId, input()); // duplicate of the tennis import
    await activities.create(
      profileId,
      input({
        sportId: 'yoga',
        localDate: '2026-10-01',
        startTime: null,
        variant: null,
        durationMin: 60,
      }),
    );
    const entries = combineActivities(
      await services.healthSync.workoutsBetween(profileId, '2026-09-27', '2026-10-03'),
      await activities.listBetween(profileId, '2026-09-27', '2026-10-03'),
    );
    expect(entries).toHaveLength(4);
    const summary = summarizeAllActivities(entries, WEEK);
    // Tennis (HC) + run (HC) + yoga (manual, 80 kg → 126 kcal); the manual tennis is left out.
    expect(summary).toMatchObject({ count: 3, durationS: (85 + 40 + 60) * 60, activeKcal: 1226 });
    expect(summarizeAllActivities([], WEEK)).toMatchObject({ count: 0, activeKcal: null });
  });
});

describe('migration 12', () => {
  it('adds the manual activities table and keeps every existing row', async () => {
    const db = await openSqlJsDriver();
    await migrate(db, migrations.slice(0, 11));
    await db.execute(`
      INSERT INTO profiles (id, created_at, updated_at) VALUES ('p', 'x', 'x');
      INSERT INTO weight_entries (id, profile_id, date, value, created_at, updated_at)
        VALUES ('w', 'p', '2026-10-01', 82.4, 'x', 'x');
    `);
    expect(await migrate(db, migrations)).toEqual([12]);
    expect(await db.query('SELECT id, value FROM weight_entries')).toEqual([
      { id: 'w', value: 82.4 },
    ]);
    expect(await db.query('SELECT * FROM manual_activities')).toEqual([]);
    await expect(
      db.run(
        `INSERT INTO manual_activities (id, profile_id, sport_id, local_date, duration_s, met,
           met_ref, met_basis, calc_method, kcal, created_at, updated_at)
         VALUES ('a', 'p', 'tennis', '2026-10-01', 30, 8, 'x', 'specific', 'm', 100, 'x', 'x')`,
      ),
    ).rejects.toThrow(/CHECK/);
    expect(await migrate(db, migrations)).toEqual([]);
  });

  it('keeps the data after a restart (new services on the same database)', async () => {
    const first = await setup();
    const created = await first.activities.create(first.profileId, input({ kcalOverride: 700 }));
    const second = await setup(first.db);
    expect(await second.activities.get(second.profileId, created.id)).toEqual(created);
  });
});

describe('manual activities: unchanged own value', () => {
  it('stays automatic when the own value equals the calculated one', async () => {
    const { activities, services, profileId } = await setup();
    await services.weight.save(profileId, '2026-10-03', 80);
    expect(await activities.create(profileId, input({ kcalOverride: 882 }))).toMatchObject({
      calculatedKcal: 882,
      kcal: 882,
      kcalOverridden: false,
    });
  });
});
