import { createServices } from '@/app/services';
import { migrate, migrations } from '@/core/database';
import { openSqlJsDriver } from '@/core/database/drivers/sqlJs';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { NutritionError } from './errors';
import type { FoodInput } from './foodService';
import { ZERO_NUTRIENTS } from './nutrients';

let now = new Date(2026, 9, 3, 12, 0);
const clock = () => now;

async function setup() {
  now = new Date(2026, 9, 3, 12, 0);
  const db = await createTestDatabase();
  const services = createServices({ driver: db, security: ENCRYPTED_TEST_SECURITY }, clock);
  const profileId = (await services.profile.ensureLocalProfile()).id;
  await services.nutrition.meals.ensureDefaults(profileId);
  const meals = await services.nutrition.meals.listActive(profileId);
  const [breakfast, lunch] = meals;
  if (!breakfast || !lunch) throw new Error('default meals expected');
  return { db, services, n: services.nutrition, profileId, breakfast, lunch };
}

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (error: unknown) => (error instanceof NutritionError ? error.code : String(error)),
  );

const oatsInput: FoodInput = {
  name: ' Haferflocken ',
  brand: 'Kölln',
  barcode: '4000540000108',
  reference: { amount: 100, unit: 'g' },
  nutrients: { ...ZERO_NUTRIENTS, energyKcal: 200, proteinG: 20, carbsG: 10, fatG: 8 },
  servings: [{ unit: 'serving', amount: 40, amountUnit: 'g', label: null }],
};

describe('foods', () => {
  it('creates custom foods, finds them by barcode and marks favourites', async () => {
    const { n, profileId } = await setup();
    const oats = await n.foods.create(profileId, oatsInput);
    expect(oats).toMatchObject({ name: 'Haferflocken', source: 'custom', favorite: false });
    expect((await n.foods.findByBarcode(profileId, '4000540000108')).map((f) => f.id)).toEqual([
      oats.id,
    ]);
    await n.foods.setFavorite(profileId, oats.id, true);
    expect((await n.foods.list(profileId, { favoritesOnly: true })).map((f) => f.id)).toEqual([
      oats.id,
    ]);
    expect(await n.foods.get(profileId, oats.id)).toMatchObject({
      servings: [{ unit: 'serving', amount: 40, amountUnit: 'g', label: null }],
    });
  });

  it('validates names, units and values', async () => {
    const { n, profileId } = await setup();
    expect(await code(n.foods.create(profileId, { ...oatsInput, name: '  ' }))).toBe(
      'invalid-name',
    );
    expect(
      await code(n.foods.create(profileId, { ...oatsInput, reference: { amount: 0, unit: 'g' } })),
    ).toBe('invalid-unit');
    expect(
      await code(
        n.foods.create(profileId, {
          ...oatsInput,
          nutrients: { ...oatsInput.nutrients, proteinG: -1 },
        }),
      ),
    ).toBe('invalid-value');
  });

  it('stores an external product once and refreshes it on re-import (offline afterwards)', async () => {
    const { n, profileId, db } = await setup();
    const external = {
      provider: 'future-provider',
      externalId: '123',
      name: 'Skyr',
      brand: 'Arla',
      barcode: '5700000000001',
      reference: { amount: 100, unit: 'g' as const },
      nutrients: { ...ZERO_NUTRIENTS, energyKcal: 63, proteinG: 11, carbsG: 4, fatG: 0.2 },
      servings: [],
    };
    const first = await n.foods.importExternal(profileId, external);
    const again = await n.foods.importExternal(profileId, {
      ...external,
      nutrients: { ...external.nutrients, energyKcal: 65 },
    });
    expect(again.id).toBe(first.id);
    expect(again).toMatchObject({ source: 'external', provider: 'future-provider' });
    const rows = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM foods');
    expect(rows[0]?.n).toBe(1);
    expect((await n.foods.get(profileId, first.id)).nutrients.energyKcal).toBe(65);
  });

  it('never deletes foods, only deactivates them', async () => {
    const { n, profileId } = await setup();
    const oats = await n.foods.create(profileId, oatsInput);
    await n.foods.setActive(profileId, oats.id, false);
    expect(await n.foods.list(profileId)).toEqual([]);
    expect((await n.foods.list(profileId, { includeInactive: true })).map((f) => f.id)).toEqual([
      oats.id,
    ]);
  });
});

describe('removing foods', () => {
  it('deletes an unused food for good, including its serving sizes', async () => {
    const { db, n, profileId } = await setup();
    const oats = await n.foods.create(profileId, oatsInput);
    expect(await n.foods.remove(profileId, oats.id)).toBe('deleted');
    expect(await n.foods.list(profileId, { includeInactive: true })).toEqual([]);
    expect(await db.query('SELECT * FROM food_servings')).toEqual([]);
    expect(await code(n.foods.remove(profileId, oats.id))).toBe('not-found');
  });

  it('only hides a food that is used in the diary or a template; history stays', async () => {
    const { n, profileId, breakfast } = await setup();
    const logged = await n.foods.create(profileId, oatsInput);
    const inTemplate = await n.foods.create(profileId, { ...oatsInput, name: 'Milch' });
    await n.diary.addFood(profileId, {
      localDate: '2026-10-03',
      mealId: breakfast.id,
      foodId: logged.id,
      amount: 50,
      unit: 'g',
    });
    await n.meals.saveMeal(profileId, {
      name: 'Frühstück',
      items: [{ foodId: inTemplate.id, amount: 200, unit: 'g' }],
    });

    expect(await n.foods.remove(profileId, logged.id)).toBe('deactivated');
    expect(await n.foods.remove(profileId, inTemplate.id)).toBe('deactivated');
    expect(await n.foods.list(profileId)).toEqual([]);
    expect((await n.foods.list(profileId, { includeInactive: true })).map((f) => f.active)).toEqual(
      [false, false],
    );
    const day = await n.diary.getDay(profileId, '2026-10-03');
    expect(day.entries.map((e) => [e.name, e.nutrients.energyKcal])).toEqual([
      ['Haferflocken', 100],
    ]);
  });

  it('loads several foods by id, hidden ones included', async () => {
    const { n, profileId } = await setup();
    const oats = await n.foods.create(profileId, oatsInput);
    await n.foods.setActive(profileId, oats.id, false);
    expect((await n.foods.findMany(profileId, [oats.id])).map((f) => f.name)).toEqual([
      'Haferflocken',
    ]);
  });
});

describe('diary and history', () => {
  it('logs quantities and keeps past values when a food is corrected', async () => {
    const { n, profileId, breakfast } = await setup();
    const oats = await n.foods.create(profileId, oatsInput);
    const entry = await n.diary.addFood(profileId, {
      localDate: '2026-10-02',
      mealId: breakfast.id,
      foodId: oats.id,
      amount: 150,
      unit: 'g',
    });
    expect(entry.nutrients).toMatchObject({ energyKcal: 300, proteinG: 30 });

    // Correction: 180 kcal / 100 g from now on.
    await n.foods.update(profileId, oats.id, {
      ...oatsInput,
      nutrients: { ...oatsInput.nutrients, energyKcal: 180 },
    });
    const past = await n.diary.getDay(profileId, '2026-10-02');
    expect(past.entries[0]?.nutrients.energyKcal).toBe(300);
    expect(past.summary.totals.totals.energyKcal).toBe(300);

    const today = await n.diary.addFood(profileId, {
      localDate: '2026-10-03',
      mealId: breakfast.id,
      foodId: oats.id,
      amount: 1,
      unit: 'serving',
    });
    expect(today.nutrients.energyKcal).toBe(72);
  });

  it('rescales an entry from its own snapshot and refuses incompatible units', async () => {
    const { n, profileId, breakfast } = await setup();
    const oats = await n.foods.create(profileId, oatsInput);
    const entry = await n.diary.addFood(profileId, {
      localDate: '2026-10-03',
      mealId: breakfast.id,
      foodId: oats.id,
      amount: 100,
      unit: 'g',
    });
    await n.foods.update(profileId, oats.id, {
      ...oatsInput,
      nutrients: { ...oatsInput.nutrients, energyKcal: 999 },
    });
    const updated = await n.diary.updateQuantity(profileId, entry.id, 0.05, 'kg');
    expect(updated.nutrients).toMatchObject({ energyKcal: 100, proteinG: 10 });
    expect(await code(n.diary.updateQuantity(profileId, entry.id, 1, 'piece'))).toBe(
      'incompatible-unit',
    );
  });

  it('keeps meal names of logged days when meals are renamed or deactivated', async () => {
    const { n, profileId, breakfast, lunch } = await setup();
    const oats = await n.foods.create(profileId, oatsInput);
    await n.diary.addFood(profileId, {
      localDate: '2026-10-02',
      mealId: lunch.id,
      foodId: oats.id,
      amount: 50,
      unit: 'g',
    });
    await n.meals.rename(profileId, lunch.id, 'Mittag');
    await n.meals.setActive(profileId, lunch.id, false);
    const [entry] = (await n.diary.getDay(profileId, '2026-10-02')).entries;
    expect(entry).toMatchObject({ mealId: lunch.id, mealDefaultKey: 'lunch', mealName: null });

    await n.diary.moveEntry(profileId, entry?.id ?? '', {
      localDate: '2026-10-03',
      mealId: breakfast.id,
    });
    expect((await n.diary.getDay(profileId, '2026-10-02')).entries).toEqual([]);
    expect((await n.diary.getDay(profileId, '2026-10-03')).entries[0]?.mealDefaultKey).toBe(
      'breakfast',
    );
  });

  it('refuses invalid days, foreign ids and inactive foods', async () => {
    const { n, profileId, breakfast } = await setup();
    const oats = await n.foods.create(profileId, oatsInput);
    const base = { mealId: breakfast.id, foodId: oats.id, amount: 50, unit: 'g' as const };
    expect(await code(n.diary.addFood(profileId, { ...base, localDate: '3.10.2026' }))).toBe(
      'invalid-value',
    );
    expect(await code(n.diary.addFood('other', { ...base, localDate: '2026-10-03' }))).toBe(
      'not-found',
    );
    await n.foods.setActive(profileId, oats.id, false);
    expect(await code(n.diary.addFood(profileId, { ...base, localDate: '2026-10-03' }))).toBe(
      'food-inactive',
    );
  });

  it('assigns entries to the local calendar day, also right before midnight', async () => {
    const { n, profileId } = await setup();
    now = new Date(2026, 9, 3, 23, 59, 30);
    expect(n.diary.todayKey()).toBe('2026-10-03');
    await n.diary.addWater(profileId, { localDate: n.diary.todayKey(), amount: 300, unit: 'ml' });
    now = new Date(2026, 9, 4, 0, 0, 30);
    expect(n.diary.todayKey()).toBe('2026-10-04');
    await n.diary.addWater(profileId, { localDate: n.diary.todayKey(), amount: 200, unit: 'ml' });
    expect((await n.diary.getDay(profileId, '2026-10-03')).waterMl).toBe(300);
    expect((await n.diary.getDay(profileId, '2026-10-04')).waterMl).toBe(200);
  });
});

describe('meals and saved meals', () => {
  it('starts with four default meals, once', async () => {
    const { n, profileId } = await setup();
    await n.meals.ensureDefaults(profileId);
    expect((await n.meals.listAll(profileId)).map((m) => m.defaultKey)).toEqual([
      'breakfast',
      'lunch',
      'dinner',
      'snacks',
    ]);
  });

  it('adds, renames, reorders and deactivates meals but keeps one active', async () => {
    const { n, profileId } = await setup();
    const pre = await n.meals.add(profileId, 'Pre-Workout');
    await n.meals.move(profileId, pre.id, -1);
    const all = await n.meals.listAll(profileId);
    expect(all.map((m) => m.name ?? m.defaultKey)).toEqual([
      'breakfast',
      'lunch',
      'dinner',
      'Pre-Workout',
      'snacks',
    ]);
    await n.meals.rename(profileId, all[0]?.id ?? '', 'Morgens');
    expect((await n.meals.listAll(profileId))[0]).toMatchObject({
      defaultKey: 'breakfast',
      name: 'Morgens',
    });
    for (const meal of all.slice(1)) await n.meals.setActive(profileId, meal.id, false);
    expect(await code(n.meals.setActive(profileId, all[0]?.id ?? '', false))).toBe('last-meal');
    expect(await n.meals.listActive(profileId)).toHaveLength(1);
  });

  it('keeps saved meals as templates and applies them (also edited) with current values', async () => {
    const { n, profileId, breakfast } = await setup();
    const oats = await n.foods.create(profileId, oatsInput);
    const milk = await n.foods.create(profileId, {
      name: 'Milch',
      reference: { amount: 100, unit: 'ml' },
      nutrients: { ...ZERO_NUTRIENTS, energyKcal: 64, proteinG: 3.4, carbsG: 4.8, fatG: 3.5 },
    });
    const template = await n.meals.saveMeal(profileId, {
      name: 'Standard-Frühstück',
      mealId: breakfast.id,
      items: [
        { foodId: milk.id, amount: 250, unit: 'ml' },
        { foodId: oats.id, amount: 60, unit: 'g' },
      ],
    });
    // The template is not a logged day.
    expect((await n.diary.getDay(profileId, '2026-10-03')).entries).toEqual([]);

    const added = await n.diary.addSavedMeal(profileId, {
      savedMealId: template.id,
      localDate: '2026-10-03',
      mealId: breakfast.id,
    });
    expect(added.map((e) => [e.name, e.nutrients.energyKcal])).toEqual([
      ['Milch', 160],
      ['Haferflocken', 120],
    ]);

    // Edited before adding: only 30 g oats this time – the template stays as it was.
    await n.diary.addSavedMeal(profileId, {
      savedMealId: template.id,
      localDate: '2026-10-04',
      mealId: breakfast.id,
      items: [{ foodId: oats.id, amount: 30, unit: 'g' }],
    });
    expect((await n.diary.getDay(profileId, '2026-10-04')).summary.totals.totals.energyKcal).toBe(
      60,
    );
    expect((await n.meals.getSavedMeal(profileId, template.id)).items.map((i) => i.amount)).toEqual(
      [250, 60],
    );
  });
});

describe('recipes', () => {
  it('computes totals and servings and logs portions as snapshots', async () => {
    const { n, profileId, lunch } = await setup();
    const oats = await n.foods.create(profileId, oatsInput);
    const recipe = await n.recipes.create(profileId, {
      name: 'Overnight Oats',
      servings: 2,
      ingredients: [{ foodId: oats.id, amount: 0.2, unit: 'kg', note: 'grob' }],
    });
    const nutrition = await n.recipes.nutrition(profileId, recipe.id);
    expect(nutrition.total.totals.energyKcal).toBe(400);
    expect(nutrition.perServing.totals.proteinG).toBe(20);

    const entry = await n.diary.addRecipe(profileId, {
      recipeId: recipe.id,
      servings: 1.5,
      localDate: '2026-10-03',
      mealId: lunch.id,
    });
    expect(entry).toMatchObject({ recipeId: recipe.id, unit: 'serving', amount: 1.5 });
    expect(entry.nutrients.energyKcal).toBe(300);

    await n.recipes.delete(profileId, recipe.id);
    const [kept] = (await n.diary.getDay(profileId, '2026-10-03')).entries;
    expect(kept).toMatchObject({ name: 'Overnight Oats', recipeId: null });
    expect(kept?.nutrients.energyKcal).toBe(300);
  });
});

describe('water', () => {
  it('adds up several entries per day and keeps past days', async () => {
    const { n, profileId } = await setup();
    await n.diary.addWater(profileId, { localDate: '2026-10-02', amount: 1.5, unit: 'l' });
    await n.diary.addWater(profileId, { localDate: '2026-10-03', amount: 500, unit: 'ml' });
    const glass = await n.diary.addWater(profileId, {
      localDate: '2026-10-03',
      amount: 0.25,
      unit: 'l',
    });
    expect((await n.diary.getDay(profileId, '2026-10-03')).waterMl).toBe(750);
    expect((await n.diary.getDay(profileId, '2026-10-02')).waterMl).toBe(1500);
    await n.diary.deleteWater(profileId, glass.id);
    expect((await n.diary.getDay(profileId, '2026-10-03')).waterMl).toBe(500);
    expect(
      await code(n.diary.addWater(profileId, { localDate: '2026-10-03', amount: 0, unit: 'ml' })),
    ).toBe('invalid-value');
  });
});

describe('water corrections', () => {
  it('changes and deletes entries and never counts water as energy', async () => {
    const { n, profileId } = await setup();
    const glass = await n.diary.addWater(profileId, {
      localDate: '2026-10-03',
      amount: 250,
      unit: 'ml',
    });
    await n.diary.addWater(profileId, { localDate: '2026-10-03', amount: 500, unit: 'ml' });
    const updated = await n.diary.updateWater(profileId, glass.id, 330, 'ml');
    expect(updated.amount).toBe(330);
    const day = await n.diary.getDay(profileId, '2026-10-03');
    expect(day.waterMl).toBe(830);
    expect(day.summary.totals.totals.energyKcal).toBe(0);
    expect(day.summary.entryCount).toBe(0);

    expect(await code(n.diary.updateWater(profileId, glass.id, 0, 'ml'))).toBe('invalid-value');
    expect(await code(n.diary.updateWater(profileId, glass.id, 6000, 'ml'))).toBe('invalid-value');
    expect(await code(n.diary.updateWater(profileId, 'missing', 200, 'ml'))).toBe('not-found');
    await n.diary.deleteWater(profileId, glass.id);
    expect((await n.diary.getDay(profileId, '2026-10-03')).waterMl).toBe(500);
  });
});

describe('goals', () => {
  it('stores all five targets with automatic and manual values per start day', async () => {
    const { n, profileId } = await setup();
    await n.goals.save(profileId, {
      effectiveFrom: '2026-09-01',
      goalType: 'gain',
      targets: {
        energyKcal: { auto: 2800, manual: null },
        proteinG: { auto: 180, manual: null },
        carbsG: { auto: 330, manual: null },
        fatG: { auto: 80, manual: null },
        waterMl: { auto: 3000, manual: null },
      },
    });
    await n.goals.setManual(profileId, '2026-09-15', 'energyKcal', 2600);
    const september = await n.goals.goalFor(profileId, '2026-09-20');
    expect(september?.goal.goalType).toBe('gain');
    expect(september?.effective.energyKcal).toEqual({ value: 2600, origin: 'manual' });
    expect(september?.goal.targets.energyKcal).toEqual({ auto: 2800, manual: 2600 });
    expect(september?.effective.waterMl).toEqual({ value: 3000, origin: 'auto' });

    // A new goal from October does not change how September is judged.
    await n.goals.save(profileId, {
      effectiveFrom: '2026-10-01',
      goalType: 'lose',
      targets: { energyKcal: { auto: 2100, manual: null } },
    });
    expect((await n.goals.goalFor(profileId, '2026-09-20'))?.goal.goalType).toBe('gain');
    expect((await n.goals.goalFor(profileId, '2026-10-03'))?.effective.energyKcal.value).toBe(2100);
    expect(await n.goals.goalFor(profileId, '2026-08-31')).toBeNull();

    // Back to automatic.
    await n.goals.setManual(profileId, '2026-09-20', 'energyKcal', null);
    expect((await n.goals.goalFor(profileId, '2026-09-20'))?.effective.energyKcal.origin).toBe(
      'auto',
    );
  });

  it('rejects implausible goals', async () => {
    const { n, profileId } = await setup();
    expect(
      await code(
        n.goals.save(profileId, {
          goalType: 'maintain',
          targets: { energyKcal: { auto: 100, manual: null } },
        }),
      ),
    ).toBe('invalid-value');
  });
});

describe('body weight for nutrition', () => {
  it('reads weight from the health data instead of storing it again', async () => {
    const { services, profileId, db } = await setup();
    await services.weight.save(profileId, '2026-09-20', 84.2);
    await services.weight.save(profileId, '2026-10-02', 83.5);
    expect(await services.bodyWeight.latestKgOnOrBefore(profileId, '2026-10-01')).toBe(84.2);
    expect(await services.bodyWeight.latestKgOnOrBefore(profileId, '2026-10-03')).toBe(83.5);
    expect(await services.bodyWeight.latestKgOnOrBefore(profileId, '2026-09-01')).toBeNull();
    const tables = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%weight%' ORDER BY name",
    );
    // Nutrition keeps no weight table of its own. `imported_weights` belongs to the health
    // import (Health Connect) and is display-only – nutrition never reads it.
    expect(tables.map((t) => t.name)).toEqual(['imported_weights', 'weight_entries']);
  });
});

describe('schema', () => {
  it('upgrades a version 5 database without touching existing data', async () => {
    const db = await openSqlJsDriver();
    await migrate(db, migrations.slice(0, 5));
    await db.execute(`
      INSERT INTO profiles (id, created_at, updated_at) VALUES ('p', 'x', 'x');
      INSERT INTO weight_entries (id, profile_id, date, value, created_at, updated_at)
        VALUES ('w', 'p', '2026-10-01', 82.4, 'x', 'x');
      INSERT INTO workouts (id, profile_id, training_type, status, started_at, ended_at,
        duration_s, local_date, created_at, updated_at)
        VALUES ('wo', 'p', 'strength', 'completed', 'x', 'y', 60, '2026-10-01', 'x', 'x');
    `);
    expect(await migrate(db, migrations)).toEqual([6, 7, 8, 9, 10, 11]);
    expect(await db.query('SELECT value FROM weight_entries')).toEqual([{ value: 82.4 }]);
    expect(await db.query('SELECT id FROM workouts')).toEqual([{ id: 'wo' }]);
    expect(await db.query('SELECT COUNT(*) AS n FROM food_entries')).toEqual([{ n: 0 }]);
  });

  it('uses indexes for day queries', async () => {
    const { db, profileId } = await setup();
    const plan = async (sql: string) =>
      (await db.query<{ detail: string }>(`EXPLAIN QUERY PLAN ${sql}`, [profileId, '2026-10-03']))
        .map((r) => r.detail)
        .join(' | ');
    expect(
      await plan('SELECT * FROM food_entries WHERE profile_id = ? AND local_date = ?'),
    ).toMatch(/USING INDEX food_entries_day/);
    expect(
      await plan('SELECT * FROM water_entries WHERE profile_id = ? AND local_date = ?'),
    ).toMatch(/USING INDEX water_entries_day/);
  });

  it('removes nutrition data together with the profile', async () => {
    const { n, profileId, breakfast, db } = await setup();
    const oats = await n.foods.create(profileId, oatsInput);
    await n.diary.addFood(profileId, {
      localDate: '2026-10-03',
      mealId: breakfast.id,
      foodId: oats.id,
      amount: 50,
      unit: 'g',
    });
    await n.diary.addWater(profileId, { localDate: '2026-10-03', amount: 300, unit: 'ml' });
    await db.run('DELETE FROM profiles WHERE id = ?', [profileId]);
    for (const table of ['foods', 'food_entries', 'water_entries', 'meal_slots']) {
      expect(await db.query(`SELECT COUNT(*) AS n FROM ${table}`)).toEqual([{ n: 0 }]);
    }
  });
});
