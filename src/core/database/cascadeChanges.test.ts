import { createServices } from '@/app/services';
import { ZERO_NUTRIENTS } from '@/core/nutrition';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import type { DatabaseDriver, SqlExecutor } from './types';

/**
 * Reports changed rows like the native SQLite plugin does (`total_changes()` before and after
 * the statement): rows removed or updated by foreign-key actions count as well. sql.js reports
 * only the rows of the statement itself.
 */
function countingCascades(inner: DatabaseDriver): DatabaseDriver {
  const wrap = (executor: SqlExecutor): SqlExecutor => ({
    execute: (sql) => executor.execute(sql),
    query: (sql, params) => executor.query(sql, params),
    run: async (sql, params) => {
      const total = async () =>
        (await executor.query<{ n: number }>('SELECT total_changes() AS n'))[0]?.n ?? 0;
      const before = await total();
      await executor.run(sql, params);
      return { changes: (await total()) - before };
    },
  });
  return {
    ...wrap(inner),
    transaction: (work) => inner.transaction((tx) => work(wrap(tx))),
    close: () => inner.close(),
  };
}

let now = new Date(2026, 9, 3, 12, 0);
const clock = () => now;

async function setup() {
  now = new Date(2026, 9, 3, 12, 0);
  const driver = countingCascades(await createTestDatabase());
  const services = createServices({ driver, security: ENCRYPTED_TEST_SECURITY }, clock);
  const profileId = (await services.profile.ensureLocalProfile()).id;
  return { driver, services, profileId };
}

describe('deleting with rows that depend on it (native plugin counting)', () => {
  it('counts the cascaded rows like the plugin – the case the repositories must handle', async () => {
    const { driver, services, profileId } = await setup();
    const n = services.nutrition;
    const food = await n.foods.create(profileId, {
      name: 'Hafer',
      reference: { amount: 100, unit: 'g' },
      nutrients: { ...ZERO_NUTRIENTS, energyKcal: 370 },
    });
    const recipe = await n.recipes.create(profileId, {
      name: 'Porridge',
      servings: 1,
      ingredients: [{ foodId: food.id, amount: 50, unit: 'g' }],
    });
    const result = await driver.run('DELETE FROM recipes WHERE id = ?', [recipe.id]);
    expect(result.changes).toBe(2); // the recipe and its ingredient
  });

  it('deletes recipes and templates that have ingredients, items and logged days', async () => {
    const { services, profileId } = await setup();
    const n = services.nutrition;
    await n.meals.ensureDefaults(profileId);
    const [meal] = await n.meals.listActive(profileId);
    const food = await n.foods.create(profileId, {
      name: 'Hafer',
      reference: { amount: 100, unit: 'g' },
      nutrients: { ...ZERO_NUTRIENTS, energyKcal: 370 },
    });
    const recipe = await n.recipes.create(profileId, {
      name: 'Porridge',
      servings: 1,
      ingredients: [{ foodId: food.id, amount: 50, unit: 'g' }],
    });
    await n.diary.addRecipe(profileId, {
      recipeId: recipe.id,
      servings: 1,
      localDate: '2026-10-03',
      mealId: meal?.id ?? '',
    });
    await n.recipes.delete(profileId, recipe.id);
    expect(await n.recipes.list(profileId)).toEqual([]);
    expect((await n.diary.getDay(profileId, '2026-10-03')).entries).toHaveLength(1);

    const template = await n.meals.saveMeal(profileId, {
      name: 'Frühstück',
      items: [{ foodId: food.id, amount: 50, unit: 'g' }],
    });
    await n.meals.deleteSavedMeal(profileId, template.id);
    expect(await n.meals.listSavedMeals(profileId)).toEqual([]);
    // Unknown ids are still reported as not found.
    await expect(n.recipes.delete(profileId, recipe.id)).rejects.toMatchObject({
      code: 'not-found',
    });
  });

  it('deletes plans, plan days and finished workouts that have dependent rows', async () => {
    const { services, profileId } = await setup();
    const t = services.training;
    await t.exercises.ensureCatalog();
    const plan = await t.plans.createPlan(profileId, 'Ganzkörper');
    const dayA = await t.plans.addDay(profileId, plan.id, 'Tag A');
    const dayB = await t.plans.addDay(profileId, plan.id, 'Tag B');
    await t.plans.addExercise(profileId, dayA, 'sys.back-squat');
    await t.plans.addExercise(profileId, dayB, 'sys.back-squat');
    const workout = await t.workouts.startFromPlan(profileId, dayA);
    await t.workouts.finish(profileId, workout.id);
    const second = await t.workouts.startFromPlan(profileId, dayB);
    await t.workouts.finish(profileId, second.id);

    await t.plans.deleteDay(profileId, dayB);
    expect((await t.plans.getPlan(profileId, plan.id)).days.map((d) => d.name)).toEqual(['Tag A']);
    await t.plans.deletePlan(profileId, plan.id);
    expect(await t.plans.listPlans(profileId)).toEqual([]);
    // History stays with its snapshot names.
    expect((await t.workouts.getDetail(profileId, workout.id)).planName).toBe('Ganzkörper');

    await t.workouts.delete(profileId, second.id);
    await expect(t.workouts.getDetail(profileId, second.id)).rejects.toBeTruthy();
  });
});
