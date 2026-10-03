import { createServices } from '@/app/services';
import { migrate, migrations } from '@/core/database';
import { openSqlJsDriver } from '@/core/database/drivers/sqlJs';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { FakeHealthPlatform } from '@/test/fakeHealthPlatform';
import {
  countsActivityCaloriesOn,
  INITIAL_EFFECTIVE_FROM,
  TargetError,
  targetOn,
  weeklyExpectation,
  type TargetKind,
} from './targets';

// Saturday, 3 October 2026, 10:00 local time.
let now = new Date(2026, 9, 3, 10);
const clock = () => now;
const at = (month: number, day: number) => new Date(2026, month - 1, day, 9);

/** The 7 days ending on `end` (YYYY-MM-DD), oldest first. */
function week(endMonth: number, endDay: number): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(2026, endMonth - 1, endDay - 6 + i);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  });
}

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
  return { db: database, platform, services, profileId };
}
type Setup = Awaited<ReturnType<typeof setup>>;

async function setOn(s: Setup, day: Date, kind: TargetKind, value: number | null) {
  now = day;
  await s.services.targets.set(s.profileId, kind, value);
  now = new Date(2026, 9, 3, 10);
}

async function workout(s: Setup, start: Date) {
  now = start;
  const own = await s.services.training.workouts.startFree(s.profileId);
  now = new Date(start.getTime() + 60 * 60_000);
  await s.services.training.workouts.finish(s.profileId, own.id);
  now = new Date(2026, 9, 3, 10);
}

const scoreOptions = { today: '2026-10-03' };

describe('targetOn', () => {
  const versions = [
    { effectiveFrom: '2026-09-01', value: 3 },
    { effectiveFrom: '2026-09-20', value: 5 },
    { effectiveFrom: '2026-09-25', value: null },
  ];
  it('picks the latest version that started on or before the day', () => {
    expect(targetOn(versions, '2026-08-31')).toBeNull();
    expect(targetOn(versions, '2026-09-01')).toBe(3);
    expect(targetOn(versions, '2026-09-19')).toBe(3);
    expect(targetOn(versions, '2026-09-20')).toBe(5);
    expect(targetOn(versions, '2026-09-25')).toBeNull();
    expect(targetOn([], '2026-09-25')).toBeNull();
  });
});

describe('versioned targets', () => {
  it.each(['trainingsPerWeek', 'activeMinutesPerWeek', 'stepsPerDay'] as const)(
    '%s: a change starts a new version and never touches the old one',
    async (kind) => {
      const s = await setup();
      const a = kind === 'stepsPerDay' ? 6000 : kind === 'trainingsPerWeek' ? 3 : 120;
      const b = kind === 'stepsPerDay' ? 10000 : kind === 'trainingsPerWeek' ? 5 : 240;
      await setOn(s, at(9, 1), kind, a);
      await setOn(s, at(9, 20), kind, b);
      const history = (await s.services.targets.history(s.profileId))[kind];
      expect(history.map((v) => [v.effectiveFrom, v.value])).toEqual([
        ['2026-09-01', a],
        ['2026-09-20', b],
      ]);
      // Target A applies until the day before X, target B from X on.
      expect(await s.services.targets.valueOn(s.profileId, kind, '2026-09-19')).toBe(a);
      expect(await s.services.targets.valueOn(s.profileId, kind, '2026-09-20')).toBe(b);
      // A change today leaves the past alone.
      await s.services.targets.set(s.profileId, kind, null);
      expect(await s.services.targets.valueOn(s.profileId, kind, '2026-09-19')).toBe(a);
      expect(await s.services.targets.valueOn(s.profileId, kind, '2026-10-02')).toBe(b);
      expect(await s.services.targets.valueOn(s.profileId, kind, '2026-10-03')).toBeNull();
    },
  );

  it('replaces a second change on the same day and stores nothing for an unchanged value', async () => {
    const s = await setup();
    await setOn(s, at(9, 1), 'trainingsPerWeek', 3);
    await s.services.targets.set(s.profileId, 'trainingsPerWeek', 4);
    await s.services.targets.set(s.profileId, 'trainingsPerWeek', 5);
    let history = (await s.services.targets.history(s.profileId)).trainingsPerWeek;
    expect(history.map((v) => [v.effectiveFrom, v.value])).toEqual([
      ['2026-09-01', 3],
      ['2026-10-03', 5],
    ]);
    // Back to the value that applied before: today's version says 3 again.
    await s.services.targets.set(s.profileId, 'trainingsPerWeek', 3);
    history = (await s.services.targets.history(s.profileId)).trainingsPerWeek;
    expect(history.at(-1)).toMatchObject({ effectiveFrom: '2026-10-03', value: 3 });
    // An unchanged value on another day adds no version.
    await setOn(s, at(10, 3), 'activeMinutesPerWeek', 150);
    now = new Date(2026, 9, 4, 9);
    await s.services.targets.set(s.profileId, 'activeMinutesPerWeek', 150);
    now = new Date(2026, 9, 3, 10);
    expect((await s.services.targets.history(s.profileId)).activeMinutesPerWeek).toHaveLength(1);
  });

  it('rejects invalid values', async () => {
    const s = await setup();
    for (const [kind, value] of [
      ['trainingsPerWeek', 0],
      ['trainingsPerWeek', 15],
      ['trainingsPerWeek', 2.5],
      ['activeMinutesPerWeek', 5],
      ['stepsPerDay', 500],
      ['stepsPerDay', 60000],
    ] as const) {
      await expect(s.services.targets.set(s.profileId, kind, value)).rejects.toBeInstanceOf(
        TargetError,
      );
    }
  });

  it('"Aktivitätskalorien anrechnen": off by default, a choice persists, only on or off', async () => {
    const first = await setup();
    expect((await first.services.targets.current(first.profileId)).activityCalories).toBeNull();
    await first.services.targets.set(first.profileId, 'activityCalories', 1);
    // A new service (app restart) reads the stored choice.
    const second = await setup(first.db);
    expect((await second.services.targets.current(second.profileId)).activityCalories).toBe(1);
    for (const invalid of [2, -1, 0.5]) {
      await expect(
        second.services.targets.set(second.profileId, 'activityCalories', invalid),
      ).rejects.toBeInstanceOf(TargetError);
    }
    await second.services.targets.set(second.profileId, 'activityCalories', 0);
    expect((await first.services.targets.current(first.profileId)).activityCalories).toBe(0);
  });

  it('"Aktivitätskalorien anrechnen": each day keeps the setting it had when switched', async () => {
    const s = await setup();
    await setOn(s, at(9, 10), 'activityCalories', 1);
    await setOn(s, at(9, 20), 'activityCalories', 0);
    await setOn(s, at(9, 25), 'activityCalories', 1);
    const versions = (await s.services.targets.history(s.profileId)).activityCalories;
    const on = (date: string) => countsActivityCaloriesOn(versions, date);
    expect([on('2026-09-09'), on('2026-09-10'), on('2026-09-19')]).toEqual([false, true, true]);
    expect([on('2026-09-20'), on('2026-09-24'), on('2026-09-25')]).toEqual([false, false, true]);
    // Switched off and on again today: one version for today, the past stays.
    await s.services.targets.set(s.profileId, 'activityCalories', 0);
    await s.services.targets.set(s.profileId, 'activityCalories', 1);
    const after = (await s.services.targets.history(s.profileId)).activityCalories;
    expect(after.filter((v) => v.effectiveFrom === '2026-10-03')).toHaveLength(1);
    expect(countsActivityCaloriesOn(after, '2026-09-22')).toBe(false);
  });

  it('keeps the versions after a restart and deletes them with the profile', async () => {
    const first = await setup();
    await setOn(first, at(9, 1), 'stepsPerDay', 8000);
    const second = await setup(first.db);
    expect((await second.services.targets.current(second.profileId)).stepsPerDay).toBe(8000);
    await second.db.run('DELETE FROM profiles WHERE id = ?', [second.profileId]);
    expect(await second.db.query('SELECT * FROM goal_targets')).toEqual([]);
  });
});

describe('score with versioned targets', () => {
  it('training: an old period uses target A, a new one target B, a change today alters neither', async () => {
    const s = await setup();
    await setOn(s, at(9, 1), 'trainingsPerWeek', 2);
    await setOn(s, at(9, 20), 'trainingsPerWeek', 4);
    // Two workouts in each week.
    for (const day of [14, 16, 28, 30]) await workout(s, at(9, day));
    const old = await s.services.score.calculate(s.profileId, week(9, 19), scoreOptions);
    const recent = await s.services.score.calculate(s.profileId, week(10, 3), scoreOptions);
    expect(old.areas.training).toMatchObject({ score: 100, detail: { target: 2, expected: 2 } });
    expect(recent.areas.training).toMatchObject({ score: 50, detail: { target: 4, expected: 4 } });

    await s.services.targets.set(s.profileId, 'trainingsPerWeek', 7);
    const oldAgain = await s.services.score.calculate(s.profileId, week(9, 19), scoreOptions);
    expect(oldAgain.areas.training).toEqual(old.areas.training);
  });

  it('training: a period across the change uses each day’s own target', async () => {
    const s = await setup();
    await setOn(s, at(9, 1), 'trainingsPerWeek', 7);
    await setOn(s, at(9, 24), 'trainingsPerWeek', 14);
    // 20.–26.09.: 4 days at 7/week (4 expected) + 3 days at 14/week (6 expected) = 10.
    for (const day of [20, 21, 22, 23, 24]) await workout(s, at(9, day));
    const result = await s.services.score.calculate(s.profileId, week(9, 26), scoreOptions);
    expect(result.areas.training.detail).toMatchObject({ expected: 10, done: 5, target: 14 });
    expect(result.areas.training.score).toBe(50);
  });

  it('training: a target set only today is not judged against a whole week', async () => {
    const s = await setup();
    await s.services.targets.set(s.profileId, 'trainingsPerWeek', 3);
    const none = await s.services.score.calculate(s.profileId, week(10, 3), scoreOptions);
    expect(none.areas.training.score).toBeNull();
    await workout(s, new Date(2026, 9, 3, 7));
    const one = await s.services.score.calculate(s.profileId, week(10, 3), scoreOptions);
    expect(one.areas.training.score).toBe(100);
  });

  it('activity: an old period uses target A, a new one target B, a change today alters neither', async () => {
    const s = await setup();
    await setOn(s, at(9, 1), 'activeMinutesPerWeek', 60);
    await setOn(s, at(9, 20), 'activeMinutesPerWeek', 240);
    for (const date of ['2026-09-15', '2026-09-30']) {
      await s.services.activities.create(s.profileId, {
        sportId: 'yoga',
        localDate: date,
        startTime: null,
        durationMin: 60,
        distanceKm: null,
        intensity: null,
        variant: null,
        kcalOverride: 100,
      });
    }
    const old = await s.services.score.calculate(s.profileId, week(9, 19), scoreOptions);
    const recent = await s.services.score.calculate(s.profileId, week(10, 3), scoreOptions);
    expect(old.areas.activity).toMatchObject({ score: 100, detail: { target: 60 } });
    expect(recent.areas.activity).toMatchObject({ score: 25, detail: { target: 240 } });

    await s.services.targets.set(s.profileId, 'activeMinutesPerWeek', 300);
    const oldAgain = await s.services.score.calculate(s.profileId, week(9, 19), scoreOptions);
    expect(oldAgain.areas.activity).toEqual(old.areas.activity);
  });

  it('a step target without step data never changes the score', async () => {
    const s = await setup();
    await s.services.recovery.save(s.profileId, '2026-10-03', { state: 'good', restDay: false });
    const before = await s.services.score.calculate(s.profileId, week(10, 3), scoreOptions);
    await setOn(s, at(9, 1), 'stepsPerDay', 10000);
    const after = await s.services.score.calculate(s.profileId, week(10, 3), scoreOptions);
    // Since the Phase 14 follow-up steps are a signal inside "Aktivitäten" – without step data
    // that signal is neutral: no score value moves, only the explanation knows the goal.
    expect(after.score).toBe(before.score);
    expect(after.preliminary).toBe(before.preliminary);
    expect(after.areas.activity.score).toBe(before.areas.activity.score);
    expect(after.areas.nutrition).toEqual(before.areas.nutrition);
    expect(after.areas.training).toEqual(before.areas.training);
    expect(after.areas.recovery).toEqual(before.areas.recovery);
    expect(after.areas.activity.detail.steps).toEqual({
      target: 10000,
      avgSteps: null,
      ratedDays: 0,
      reachedDays: 0,
      score: null,
    });
  });
});

describe('migration 14', () => {
  async function migratedFrom13(settings: Record<string, string>, profiles = ['p']) {
    const db = await openSqlJsDriver();
    await migrate(db, migrations.slice(0, 13));
    for (const id of profiles) {
      await db.run("INSERT INTO profiles (id, created_at, updated_at) VALUES (?, 'x', 'x')", [id]);
    }
    for (const [key, value] of Object.entries(settings)) {
      await db.run(
        "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, '2026-09-10T08:00:00.000Z')",
        [key, value],
      );
    }
    return db;
  }
  /** Migration 14 alone – migration 15 (activity calories) is tested below. */
  const upTo14 = migrations.slice(0, 14);

  it('takes over the existing weekly targets as versions from the first day, keeping old scores', async () => {
    const db = await migratedFrom13({
      trainingsPerWeek: '3',
      activeMinutesPerWeek: '150',
      countActivityCalories: 'true',
      theme: '"dark"',
    });
    expect(await migrate(db, upTo14)).toEqual([14]);
    expect(
      await db.query(
        'SELECT profile_id, kind, effective_from, value FROM goal_targets ORDER BY kind',
      ),
    ).toEqual([
      {
        profile_id: 'p',
        kind: 'activeMinutesPerWeek',
        effective_from: INITIAL_EFFECTIVE_FROM,
        value: 150,
      },
      {
        profile_id: 'p',
        kind: 'trainingsPerWeek',
        effective_from: INITIAL_EFFECTIVE_FROM,
        value: 3,
      },
    ]);
    // One source only: the old keys are gone, every other setting stays.
    expect(await db.query('SELECT key, value FROM app_settings ORDER BY key')).toEqual([
      { key: 'countActivityCalories', value: 'true' },
      { key: 'theme', value: '"dark"' },
    ]);
    expect(await migrate(db, upTo14)).toEqual([]);
  });

  it('needs no version for "no target" and skips values the app never stored', async () => {
    const db = await migratedFrom13({ trainingsPerWeek: 'null', activeMinutesPerWeek: '"x"' });
    await migrate(db, upTo14);
    expect(await db.query('SELECT * FROM goal_targets')).toEqual([]);
  });

  it('gives every local profile the taken-over target', async () => {
    const db = await migratedFrom13({ trainingsPerWeek: '4' }, ['a', 'b']);
    await migrate(db, upTo14);
    expect(
      await db.query('SELECT profile_id, value FROM goal_targets ORDER BY profile_id'),
    ).toEqual([
      { profile_id: 'a', value: 4 },
      { profile_id: 'b', value: 4 },
    ]);
  });

  it('works on a database without any target', async () => {
    const db = await migratedFrom13({});
    expect(await migrate(db, upTo14)).toEqual([14]);
    expect(await db.query('SELECT * FROM goal_targets')).toEqual([]);
    await expect(
      db.run(
        `INSERT INTO goal_targets (id, profile_id, kind, effective_from, value, created_at,
           updated_at) VALUES ('x', 'p', 'trainingsPerWeek', '2026-10-01', 40, 'c', 'u')`,
      ),
    ).rejects.toThrow(/CHECK/);
  });

  it('keeps the score of a taken-over target exactly as before', async () => {
    const first = await setup();
    // As before versioning: the target in app_settings applied to every day.
    await first.db.run('DELETE FROM goal_targets');
    await first.db.run(
      `INSERT INTO goal_targets (id, profile_id, kind, effective_from, value, created_at,
         updated_at) VALUES ('m', ?, 'trainingsPerWeek', ?, 2, 'c', 'u')`,
      [first.profileId, INITIAL_EFFECTIVE_FROM],
    );
    await workout(first, at(9, 15));
    const old = await first.services.score.calculate(first.profileId, week(9, 19), scoreOptions);
    expect(old.areas.training).toMatchObject({ score: 50, detail: { target: 2, done: 1 } });
  });
});

describe('migration 15 – "Aktivitätskalorien anrechnen" becomes a versioned target', () => {
  async function migratedFrom14(countActivityCalories: string | null, profiles = ['a']) {
    const db = await openSqlJsDriver();
    await migrate(db, migrations.slice(0, 14));
    for (const id of profiles) {
      await db.run("INSERT INTO profiles (id, created_at, updated_at) VALUES (?, 'x', 'x')", [id]);
      await db.run(
        `INSERT INTO goal_targets (id, profile_id, kind, effective_from, value, created_at,
           updated_at) VALUES (?, ?, 'stepsPerDay', '2026-09-01', 8000, 'c', 'u')`,
        [`steps-${id}`, id],
      );
    }
    await db.run(
      "INSERT INTO app_settings (key, value, updated_at) VALUES ('theme', '\"dark\"', 'x')",
    );
    if (countActivityCalories !== null) {
      await db.run(
        "INSERT INTO app_settings (key, value, updated_at) VALUES ('countActivityCalories', ?, '2026-09-10T08:00:00.000Z')",
        [countActivityCalories],
      );
    }
    return db;
  }

  it('takes over "on" for every profile from the first day, keeps every row, removes the key', async () => {
    const db = await migratedFrom14('true', ['a', 'b']);
    expect(await migrate(db, migrations)).toEqual([15]);
    expect(
      await db.query(
        `SELECT profile_id, kind, effective_from, value FROM goal_targets
         ORDER BY profile_id, kind`,
      ),
    ).toEqual([
      {
        profile_id: 'a',
        kind: 'activityCalories',
        effective_from: INITIAL_EFFECTIVE_FROM,
        value: 1,
      },
      { profile_id: 'a', kind: 'stepsPerDay', effective_from: '2026-09-01', value: 8000 },
      {
        profile_id: 'b',
        kind: 'activityCalories',
        effective_from: INITIAL_EFFECTIVE_FROM,
        value: 1,
      },
      { profile_id: 'b', kind: 'stepsPerDay', effective_from: '2026-09-01', value: 8000 },
    ]);
    // One source only: the old key is gone, every other setting stays.
    expect(await db.query('SELECT key FROM app_settings ORDER BY key')).toEqual([{ key: 'theme' }]);
    // Running the migrations again changes nothing.
    expect(await migrate(db, migrations)).toEqual([]);
    expect(await db.query('SELECT * FROM goal_targets')).toHaveLength(4);
  });

  it.each([['false'], [null]])('needs no version when the switch was off (%s)', async (stored) => {
    const db = await migratedFrom14(stored);
    await migrate(db, migrations);
    expect(await db.query("SELECT * FROM goal_targets WHERE kind = 'activityCalories'")).toEqual(
      [],
    );
    expect(
      await db.query("SELECT * FROM app_settings WHERE key = 'countActivityCalories'"),
    ).toEqual([]);
  });

  it('keeps the rules: only 0 or 1, one version per day, deleted with the profile', async () => {
    const db = await migratedFrom14('true');
    await migrate(db, migrations);
    const insert = (id: string, date: string, value: number) =>
      db.run(
        `INSERT INTO goal_targets (id, profile_id, kind, effective_from, value, created_at,
           updated_at) VALUES (?, 'a', 'activityCalories', ?, ?, 'c', 'u')`,
        [id, date, value],
      );
    await expect(insert('x', '2026-10-01', 2)).rejects.toThrow(/CHECK/);
    await insert('y', '2026-10-01', 0);
    await expect(insert('z', '2026-10-01', 1)).rejects.toThrow(/UNIQUE/);
    await db.run("DELETE FROM profiles WHERE id = 'a'");
    expect(await db.query('SELECT * FROM goal_targets')).toEqual([]);
  });

  it('every past day keeps the goal it had before the update', async () => {
    const first = await setup();
    // Saved on 1 September – it applies from that day.
    now = new Date(2026, 8, 1, 9);
    await first.services.nutrition.goals.save(first.profileId, {
      goalType: 'maintain',
      targets: {
        energyKcal: { auto: null, manual: 2300 },
        proteinG: { auto: null, manual: 160 },
        fatG: { auto: null, manual: 75 },
        carbsG: { auto: null, manual: 250 },
      },
    });
    now = new Date(2026, 9, 3, 10);
    await first.services.activities.create(first.profileId, {
      sportId: 'yoga',
      localDate: '2026-09-15',
      startTime: null,
      durationMin: 60,
      distanceKm: null,
      intensity: null,
      variant: null,
      kcalOverride: 400,
    });
    // As migration 15 takes over an "on": one version from the first day.
    await first.db.run(
      `INSERT INTO goal_targets (id, profile_id, kind, effective_from, value, created_at,
         updated_at) VALUES ('m', ?, 'activityCalories', ?, 1, 'c', 'u')`,
      [first.profileId, INITIAL_EFFECTIVE_FROM],
    );
    const goals = first.services.nutrition.goals;
    expect((await goals.dayGoal(first.profileId, '2026-09-15'))?.effective.energyKcal.value).toBe(
      2700,
    );
    // Switched off today: 15 September keeps its bonus, today has none.
    await first.services.targets.set(first.profileId, 'activityCalories', 0);
    expect((await goals.dayGoal(first.profileId, '2026-09-15'))?.effective.energyKcal.value).toBe(
      2700,
    );
    expect((await goals.dayGoal(first.profileId, '2026-10-03'))?.activity).toBeUndefined();
  });
});

describe('weekly expectation in whole units (Phase 16)', () => {
  it('rounds once, for the progress card and the score alike', () => {
    expect(weeklyExpectation(180, ['2026-10-03'])).toMatchObject({ expectedWhole: 26 });
    expect(weeklyExpectation(182, ['2026-10-03'])).toMatchObject({ expectedWhole: 26 });
    const week = ['27', '28', '29', '30'].map((d) => `2026-09-${d}`);
    expect(
      weeklyExpectation(150, [...week, '2026-10-01', '2026-10-02', '2026-10-03']),
    ).toMatchObject({ expectedWhole: 150 });
  });
});
