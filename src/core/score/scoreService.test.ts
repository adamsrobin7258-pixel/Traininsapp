import { createServices } from '@/app/services';
import { migrate, migrations } from '@/core/database';
import { openSqlJsDriver } from '@/core/database/drivers/sqlJs';
import type { HealthWorkout } from '@/core/platform/health';
import { RecoveryError } from '@/core/recovery';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import type { ScoreOptions } from './scoreService';

// Saturday, 3 October 2026, 10:00 local time.
let now = new Date(2026, 9, 3, 10);
const clock = () => now;
const TODAY = '2026-10-03';
const WEEK = [
  '2026-09-27',
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
];
const PREVIOUS_WEEK = [
  '2026-09-20',
  '2026-09-21',
  '2026-09-22',
  '2026-09-23',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
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
  return { db: database, platform, services, profileId };
}

type Setup = Awaited<ReturnType<typeof setup>>;

/** Sets a target as if it had been chosen on `day` (the clock is moved there and back). */
async function targetSince(
  { services, profileId }: Setup,
  kind: 'trainingsPerWeek' | 'activeMinutesPerWeek' | 'activityCalories',
  value: number | null,
  day = new Date(2026, 8, 1, 9),
) {
  now = day;
  await services.targets.set(profileId, kind, value);
  now = new Date(2026, 9, 3, 10);
}

const options = (patch: Partial<ScoreOptions> = {}): ScoreOptions => ({
  today: TODAY,
  ...patch,
});

async function goal(
  { services, profileId }: Setup,
  goalType: 'lose' | 'maintain' | 'gain' | 'fitness' = 'maintain',
  proteinG = 160,
) {
  // A goal applies from the day it is saved: saved on 1 September.
  now = new Date(2026, 8, 1, 9);
  await services.nutrition.goals.save(profileId, {
    goalType,
    targets: {
      energyKcal: { auto: null, manual: 2300 },
      proteinG: { auto: null, manual: proteinG },
    },
  });
  now = new Date(2026, 9, 3, 10);
}

/** Logs one food with the given kcal and protein on a day. */
async function eat(
  { services, profileId }: Setup,
  localDate: string,
  kcal: number,
  protein: number,
) {
  const n = services.nutrition;
  await n.meals.ensureDefaults(profileId);
  const [meal] = await n.meals.listActive(profileId);
  const food = await n.foods.create(profileId, {
    name: `Food ${localDate} ${kcal}`,
    reference: { amount: 100, unit: 'g' },
    nutrients: {
      energyKcal: kcal,
      proteinG: protein,
      carbsG: 0,
      fatG: 0,
      fiberG: null,
      sugarG: null,
      saturatedFatG: null,
    },
  });
  await n.diary.addFood(profileId, {
    localDate,
    mealId: meal?.id ?? '',
    foodId: food.id,
    amount: 100,
    unit: 'g',
  });
}

/** A completed Kalethra workout at the given local time (the clock is moved and reset). */
async function workout({ services, profileId }: Setup, start: Date, minutes = 60) {
  now = start;
  const own = await services.training.workouts.startFree(profileId);
  now = new Date(start.getTime() + minutes * 60_000);
  await services.training.workouts.finish(profileId, own.id);
  now = new Date(2026, 9, 3, 10);
}

function hc(id: string, type: string, day: number, hour: number, minutes: number): HealthWorkout {
  const start = localIso(2026, 10, day, hour, 0);
  return {
    id,
    type,
    start,
    end: new Date(Date.parse(start) + minutes * 60_000).toISOString(),
    activeKcal: 300,
    distanceM: null,
    source: 'Watch',
  };
}

describe('score from the real data', () => {
  it('nutrition: reads the diary and the day goals, missing days stay unknown', async () => {
    const s = await setup();
    await goal(s);
    await eat(s, '2026-09-30', 2300, 160);
    await eat(s, '2026-10-01', 2530, 160); // +10 % → 90 (kcal), protein 100 → 93
    const result = await s.services.score.calculate(s.profileId, WEEK, options());
    expect(result.areas.nutrition.score).toBe(97); // (100 + 93) / 2 = 96.5
    expect(result.areas.nutrition.detail.loggedDays).toBe(2);
    expect(result.goal).toBe('maintain');
    expect(result.goalSet).toBe(true);
  });

  it('nutrition: a manual protein goal of 220 g is used as stored', async () => {
    const s = await setup();
    await goal(s, 'maintain', 220);
    await eat(s, '2026-10-01', 2300, 160);
    const result = await s.services.score.calculate(s.profileId, WEEK, options());
    expect(result.areas.nutrition.score).toBe(90);
  });

  it('nutrition: activity calories only raise the day goal with the setting on', async () => {
    const s = await setup();
    s.platform.workouts = [{ ...hc('run', 'running', 1, 7, 45), activeKcal: 500 }];
    await s.services.healthSync.connect(s.profileId);
    await goal(s);
    await eat(s, '2026-10-01', 2800, 160);
    const off = await s.services.score.calculate(s.profileId, WEEK, options());
    await targetSince(s, 'activityCalories', 1);
    const on = await s.services.score.calculate(s.profileId, WEEK, options());
    expect(off.areas.nutrition.score).toBeLessThan(80);
    expect(on.areas.nutrition.score).toBe(100);
  });

  it('nutrition: switching activity calories on today leaves past score days unchanged', async () => {
    const s = await setup();
    s.platform.workouts = [{ ...hc('run', 'running', 1, 7, 45), activeKcal: 500 }];
    await s.services.healthSync.connect(s.profileId);
    await goal(s);
    await eat(s, '2026-10-01', 2800, 160);
    const before = await s.services.score.calculate(s.profileId, WEEK, options());
    // Switched on today (3 October): 1 October keeps the setting it had – off.
    await s.services.targets.set(s.profileId, 'activityCalories', 1);
    const after = await s.services.score.calculate(s.profileId, WEEK, options());
    expect(after.areas.nutrition.score).toBe(before.areas.nutrition.score);
    expect(after.areas.nutrition.score).toBeLessThan(80);
  });

  it('training: only Kalethra workouts count – not Health Connect or manual activities', async () => {
    const s = await setup();
    s.platform.workouts = [hc('hc-strength', 'strengthTraining', 30, 18, 60)];
    await s.services.healthSync.connect(s.profileId);
    await s.services.activities.create(s.profileId, {
      sportId: 'tennis',
      localDate: '2026-10-01',
      startTime: '17:00',
      durationMin: 60,
      distanceKm: null,
      intensity: null,
      variant: 'singles',
      kcalOverride: 500,
    });
    await targetSince(s, 'trainingsPerWeek', 2);
    const target = options();
    const before = await s.services.score.calculate(s.profileId, WEEK, target);
    expect(before.areas.training.detail.done).toBe(0);
    expect(before.areas.training.score).toBe(0);

    await workout(s, new Date(2026, 8, 29, 18));
    const after = await s.services.score.calculate(s.profileId, WEEK, target);
    expect(after.areas.training.detail.done).toBe(1);
    expect(after.areas.training.score).toBe(50);
  });

  it('training: neutral without a weekly target', async () => {
    const s = await setup();
    await workout(s, new Date(2026, 8, 29, 18));
    const result = await s.services.score.calculate(s.profileId, WEEK, options());
    expect(result.areas.training.score).toBeNull();
  });

  it('activity: manual and Health Connect minutes, a duplicate once, a Kalethra workout not again', async () => {
    const s = await setup();
    s.platform.workouts = [
      hc('run', 'running', 1, 7, 45), // counts
      hc('watch-strength', 'strengthTraining', 29, 18, 55), // = the Kalethra workout below
    ];
    await s.services.healthSync.connect(s.profileId);
    await workout(s, new Date(2026, 8, 29, 18));
    // The same run logged by hand → Health Connect wins.
    await s.services.activities.create(s.profileId, {
      sportId: 'jog',
      localDate: '2026-10-01',
      startTime: '07:05',
      durationMin: 45,
      distanceKm: null,
      intensity: null,
      variant: null,
      kcalOverride: 480,
    });
    // A separate yoga session.
    await s.services.activities.create(s.profileId, {
      sportId: 'yoga',
      localDate: '2026-10-02',
      startTime: null,
      durationMin: 30,
      distanceKm: null,
      intensity: null,
      variant: null,
      kcalOverride: 90,
    });
    await targetSince(s, 'activeMinutesPerWeek', 150);
    const result = await s.services.score.calculate(s.profileId, WEEK, options());
    expect(result.areas.activity.detail).toMatchObject({ minutes: 75, activeDays: 2 });
    expect(result.areas.activity.score).toBe(50);
  });

  it('activity: neutral without any activity data or without a target', async () => {
    const s = await setup();
    await targetSince(s, 'activeMinutesPerWeek', 150);
    const withTarget = await s.services.score.calculate(s.profileId, WEEK, options());
    expect(withTarget.areas.activity.score).toBeNull();
    await s.services.activities.create(s.profileId, {
      sportId: 'yoga',
      localDate: '2026-10-02',
      startTime: null,
      durationMin: 30,
      distanceKm: null,
      intensity: null,
      variant: null,
      kcalOverride: 90,
    });
    await targetSince(s, 'activeMinutesPerWeek', null, new Date(2026, 8, 2, 9));
    const noTarget = await s.services.score.calculate(s.profileId, WEEK, options());
    expect(noTarget.areas.activity.score).toBeNull();
    expect(noTarget.areas.activity.detail.minutes).toBe(30);
  });

  it('recovery: reads the daily entries', async () => {
    const s = await setup();
    await s.services.recovery.save(s.profileId, '2026-10-01', { state: 'good', restDay: true });
    await s.services.recovery.save(s.profileId, '2026-10-02', { state: 'poor', restDay: false });
    const result = await s.services.score.calculate(s.profileId, WEEK, options());
    expect(result.areas.recovery.score).toBe(60);
    expect(result.areas.recovery.detail).toMatchObject({ good: 1, poor: 1, restDays: 1 });
  });

  it('uses the main goal in force at the end of the period', async () => {
    const s = await setup();
    await goal(s, 'lose');
    expect((await s.services.score.calculate(s.profileId, WEEK, options())).goal).toBe('lose');
    // Saved today – it applies from today.
    await s.services.nutrition.goals.save(s.profileId, {
      goalType: 'gain',
      targets: { energyKcal: { auto: null, manual: 2800 } },
    });
    expect((await s.services.score.calculate(s.profileId, WEEK, options())).goal).toBe('gain');
    expect((await s.services.score.calculate(s.profileId, PREVIOUS_WEEK, options())).goal).toBe(
      'lose',
    );
  });

  it('compares with the period right before it', async () => {
    const s = await setup();
    await goal(s);
    for (const date of PREVIOUS_WEEK.slice(0, 4)) await eat(s, date, 2990, 160); // 65 each
    for (const date of WEEK.slice(0, 4)) await eat(s, date, 2300, 160); // 100 each
    const result = await s.services.score.withTrend(s.profileId, WEEK, PREVIOUS_WEEK, options());
    expect(result.current.score).toBe(100);
    expect(result.previous.score).toBe(65);
    expect(result.trend).toBe('up');
    expect(result.delta).toBe(35);
  });

  it('has no trend when the previous period has too little data', async () => {
    const s = await setup();
    await goal(s);
    await eat(s, PREVIOUS_WEEK[0] ?? '', 2300, 160);
    for (const date of WEEK.slice(0, 4)) await eat(s, date, 2300, 160);
    const result = await s.services.score.withTrend(s.profileId, WEEK, PREVIOUS_WEEK, options());
    expect(result.trend).toBe('none');
  });

  it('changing a recipe or a template later never changes a past score', async () => {
    const s = await setup();
    await goal(s);
    const n = s.services.nutrition;
    await n.meals.ensureDefaults(s.profileId);
    const [meal] = await n.meals.listActive(s.profileId);
    const mealId = meal?.id ?? '';
    const food = await n.foods.create(s.profileId, {
      name: 'Base',
      reference: { amount: 100, unit: 'g' },
      nutrients: {
        energyKcal: 1150,
        proteinG: 80,
        carbsG: 0,
        fatG: 0,
        fiberG: null,
        sugarG: null,
        saturatedFatG: null,
      },
    });
    // 2 servings of a recipe of 2 × 100 g → 1150 kcal / 80 g protein per serving.
    const recipe = await n.recipes.create(s.profileId, {
      name: 'Bowl',
      servings: 2,
      ingredients: [{ foodId: food.id, amount: 200, unit: 'g' }],
    });
    await n.diary.addRecipe(s.profileId, {
      recipeId: recipe.id,
      servings: 2,
      localDate: '2026-09-30',
      mealId,
    });
    const template = await n.meals.saveMeal(s.profileId, {
      name: 'Day',
      items: [{ foodId: food.id, amount: 200, unit: 'g' }],
    });
    await n.diary.addSavedMeal(s.profileId, {
      savedMealId: template.id,
      localDate: '2026-10-01',
      mealId,
    });
    const before = await s.services.score.calculate(s.profileId, WEEK, options());
    expect(before.areas.nutrition.score).toBe(100);

    await n.recipes.update(s.profileId, recipe.id, {
      name: 'Bowl',
      servings: 1,
      ingredients: [{ foodId: food.id, amount: 600, unit: 'g' }],
    });
    await n.meals.updateSavedMeal(s.profileId, template.id, {
      name: 'Day',
      items: [{ foodId: food.id, amount: 50, unit: 'g' }],
    });
    await n.recipes.delete(s.profileId, recipe.id);
    const after = await s.services.score.calculate(s.profileId, WEEK, options());
    expect(after).toEqual(before);
  });

  it('stores nothing: the score follows every change at once', async () => {
    const s = await setup();
    await goal(s);
    await eat(s, '2026-10-01', 2300, 160);
    expect((await s.services.score.calculate(s.profileId, WEEK, options())).score).toBe(100);
    await eat(s, '2026-10-01', 690, 0); // now +30 %
    expect((await s.services.score.calculate(s.profileId, WEEK, options())).score).toBe(65);
    const tables = await s.db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%score%'",
    );
    expect(tables).toEqual([]);
  });
});

describe('recovery entries', () => {
  it('saves one entry per day and replaces it', async () => {
    const s = await setup();
    const first = await s.services.recovery.save(s.profileId, TODAY, {
      state: 'moderate',
      restDay: false,
    });
    const second = await s.services.recovery.save(s.profileId, TODAY, {
      state: 'good',
      restDay: true,
    });
    expect(second?.id).toBe(first?.id);
    expect(await s.services.recovery.listBetween(s.profileId, TODAY, TODAY)).toEqual([second]);
  });

  it('removes the entry when neither a state nor a rest day is left', async () => {
    const s = await setup();
    await s.services.recovery.save(s.profileId, TODAY, { state: null, restDay: true });
    expect(
      await s.services.recovery.save(s.profileId, TODAY, { state: null, restDay: false }),
    ).toBeNull();
    expect(await s.services.recovery.get(s.profileId, TODAY)).toBeNull();
  });

  it('rejects future days and unknown states', async () => {
    const s = await setup();
    await expect(
      s.services.recovery.save(s.profileId, '2026-10-04', { state: 'good', restDay: false }),
    ).rejects.toBeInstanceOf(RecoveryError);
    await expect(
      s.services.recovery.save(s.profileId, TODAY, {
        state: 'great' as never,
        restDay: false,
      }),
    ).rejects.toBeInstanceOf(RecoveryError);
  });

  it('is deleted with the profile', async () => {
    const s = await setup();
    await s.services.recovery.save(s.profileId, TODAY, { state: 'good', restDay: false });
    await s.db.run('DELETE FROM profiles WHERE id = ?', [s.profileId]);
    expect(await s.db.query('SELECT * FROM recovery_entries')).toEqual([]);
  });
});

describe('general fitness as main goal', () => {
  it('is saved and calculated like "maintain weight"', async () => {
    const s = await setup();
    // Saved on 1 September – it applies from that day.
    now = new Date(2026, 8, 1, 9);
    await s.services.nutrition.goals.save(s.profileId, {
      goalType: 'fitness',
      targets: { energyKcal: { auto: null, manual: 2300 } },
    });
    now = new Date(2026, 9, 3, 10);
    const day = await s.services.nutrition.goals.goalFor(s.profileId, TODAY);
    expect(day?.goal.goalType).toBe('fitness');
    expect(day?.goal.goalLevel).toBeNull();
  });
});

describe('migration 13', () => {
  it('adds recovery entries and keeps every nutrition goal unchanged', async () => {
    const db = await openSqlJsDriver();
    await migrate(db, migrations.slice(0, 12));
    await db.execute(`
      INSERT INTO profiles (id, created_at, updated_at) VALUES ('p', 'x', 'x');
      INSERT INTO nutrition_goals (id, profile_id, effective_from, goal_type, energy_kcal_auto,
        energy_kcal_manual, protein_g_manual, created_at, updated_at, goal_level, activity_level,
        include_training, target_weight_kg, auto_enabled, calculation)
        VALUES ('g', 'p', '2026-09-01', 'lose', 2100, 2000, 220, 'c', 'u', 'fast', 'light', 1,
          78.5, 1, '{"x":1}');
    `);
    const before = await db.query('SELECT * FROM nutrition_goals');
    expect(await migrate(db, migrations)).toEqual([13, 14, 15]);
    expect(await db.query('SELECT * FROM nutrition_goals')).toEqual(before);
    // The new goal type is accepted, an unknown one still is not.
    await db.run(
      `INSERT INTO nutrition_goals (id, profile_id, effective_from, goal_type, created_at,
         updated_at) VALUES ('f', 'p', '2026-10-01', 'fitness', 'c', 'u')`,
    );
    await expect(
      db.run(
        `INSERT INTO nutrition_goals (id, profile_id, effective_from, goal_type, created_at,
           updated_at) VALUES ('x', 'p', '2026-10-02', 'bulk', 'c', 'u')`,
      ),
    ).rejects.toThrow(/CHECK/);
    // One goal per day is still enforced.
    await expect(
      db.run(
        `INSERT INTO nutrition_goals (id, profile_id, effective_from, goal_type, created_at,
           updated_at) VALUES ('y', 'p', '2026-10-01', 'maintain', 'c', 'u')`,
      ),
    ).rejects.toThrow(/UNIQUE/);
    // An empty recovery entry is impossible.
    await expect(
      db.run(
        `INSERT INTO recovery_entries (id, profile_id, local_date, state, rest_day, created_at,
           updated_at) VALUES ('r', 'p', '2026-10-01', NULL, 0, 'c', 'u')`,
      ),
    ).rejects.toThrow(/CHECK/);
    expect(await migrate(db, migrations)).toEqual([]);
  });

  it('keeps recovery entries after a restart', async () => {
    const first = await setup();
    const saved = await first.services.recovery.save(first.profileId, TODAY, {
      state: 'good',
      restDay: true,
    });
    const second = await setup(first.db);
    expect(await second.services.recovery.get(second.profileId, TODAY)).toEqual(saved);
  });
});

describe('weekly targets (versioned)', () => {
  it('are off by default and accept whole numbers in range or null', async () => {
    const s = await setup();
    expect(await s.services.targets.current(s.profileId)).toEqual({
      trainingsPerWeek: null,
      activeMinutesPerWeek: null,
      stepsPerDay: null,
      activityCalories: null,
    });
    await s.services.targets.set(s.profileId, 'trainingsPerWeek', 3);
    await s.services.targets.set(s.profileId, 'activeMinutesPerWeek', 150);
    expect(await s.services.targets.current(s.profileId)).toMatchObject({
      trainingsPerWeek: 3,
      activeMinutesPerWeek: 150,
    });
    await s.services.targets.set(s.profileId, 'trainingsPerWeek', null);
    expect((await s.services.targets.current(s.profileId)).trainingsPerWeek).toBeNull();
    await expect(s.services.targets.set(s.profileId, 'trainingsPerWeek', 0)).rejects.toThrow();
    await expect(s.services.targets.set(s.profileId, 'trainingsPerWeek', 2.5)).rejects.toThrow();
    await expect(
      s.services.targets.set(s.profileId, 'activeMinutesPerWeek', 5000),
    ).rejects.toThrow();
    // No longer part of the app settings – one source only.
    expect(await s.services.settings.load()).not.toHaveProperty('trainingsPerWeek');
  });
});
