import { combineActivities, summarizeAllActivities } from '@/core/activity';
import { mergeWeightDays, summarizeStepGoal } from '@/core/health';
import type { HealthWorkout } from '@/core/platform/health';
import { summarizeNutrition, ZERO_NUTRIENTS } from '@/core/nutrition';
import { targetOn } from '@/core/targets';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import { createServices } from './services';

/**
 * Chain tests across the modules (phase 12): every value has one source, every reader gets it
 * from there, and a change today never rewrites a past day. Each scenario follows one input from
 * where it is set to every place that shows or rates it.
 */

// Saturday, 3 October 2026, 10:00 local time.
const TODAY_AT = () => new Date(2026, 9, 3, 10);
let now = TODAY_AT();
const clock = () => now;
const TODAY = '2026-10-03';

/** The local days from `from` to `to` (YYYY-MM-DD), oldest first. */
function days(from: string, to: string): string[] {
  const [y, m, d] = from.split('-').map(Number);
  const result: string[] = [];
  for (let date = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1); ; date.setDate(date.getDate() + 1)) {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
    result.push(key);
    if (key === to) return result;
  }
}

const WEEK = days('2026-09-27', TODAY);

async function setup() {
  now = TODAY_AT();
  const platform = new FakeHealthPlatform();
  const services = createServices(
    { driver: await createTestDatabase(), security: ENCRYPTED_TEST_SECURITY },
    clock,
    undefined,
    undefined,
    platform,
  );
  const profile = await services.profile.ensureLocalProfile();
  await services.nutrition.meals.ensureDefaults(profile.id);
  return { platform, services, profileId: profile.id };
}
type Setup = Awaited<ReturnType<typeof setup>>;

/** Runs `work` with the clock on `localDate` (09:00) – as if the user acted on that day. */
async function on<T>(localDate: string, work: () => Promise<T>): Promise<T> {
  const [y, m, d] = localDate.split('-').map(Number);
  now = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, 9);
  try {
    return await work();
  } finally {
    now = TODAY_AT();
  }
}

async function food({ services, profileId }: Setup, name: string, kcal: number, protein = 0) {
  return services.nutrition.foods.create(profileId, {
    name,
    reference: { amount: 100, unit: 'g' },
    nutrients: { ...ZERO_NUTRIENTS, energyKcal: kcal, proteinG: protein },
  });
}

async function firstMeal({ services, profileId }: Setup) {
  const [meal] = await services.nutrition.meals.listActive(profileId);
  return meal?.id ?? '';
}

async function eat(s: Setup, localDate: string, kcal: number, protein: number) {
  const item = await food(s, `Essen ${localDate}`, kcal, protein);
  await s.services.nutrition.diary.addFood(s.profileId, {
    localDate,
    mealId: await firstMeal(s),
    foodId: item.id,
    amount: 100,
    unit: 'g',
  });
}

/** A fixed nutrition goal saved on 1 September (own values) – it applies from that day. */
async function fixedGoal({ services, profileId }: Setup, kcal = 2300, protein = 160) {
  await on('2026-09-01', () =>
    services.nutrition.goals.save(profileId, {
      goalType: 'maintain',
      targets: {
        energyKcal: { auto: null, manual: kcal },
        proteinG: { auto: null, manual: protein },
      },
    }),
  );
}

/** A completed Kalethra workout starting at the given local time. */
async function workout({ services, profileId }: Setup, start: Date, minutes = 60) {
  now = start;
  const own = await services.training.workouts.startFree(profileId);
  now = new Date(start.getTime() + minutes * 60_000);
  await services.training.workouts.finish(profileId, own.id);
  now = TODAY_AT();
}

/** A Health Connect session on a day of October 2026. */
function hc(id: string, day: number, hour: number, minutes: number, kcal: number): HealthWorkout {
  const start = localIso(2026, 10, day, hour, 0);
  return {
    id,
    type: 'running',
    start,
    end: new Date(Date.parse(start) + minutes * 60_000).toISOString(),
    activeKcal: kcal,
    distanceM: null,
    source: 'Watch',
  };
}

const manual = (
  localDate: string,
  startTime: string | null,
  durationMin: number,
  kcalOverride: number | null,
  sportId = 'jog',
) => ({
  sportId,
  localDate,
  startTime,
  durationMin,
  distanceKm: null,
  intensity: null,
  variant: null,
  kcalOverride,
});

const options = { today: TODAY };

describe('A · profile → nutrition goals → progress', () => {
  it('a body data change today starts a new goal version; past days, diary and progress keep theirs', async () => {
    const s = await setup();
    const { services, profileId } = s;
    // 20 September: body data, a week of own weighings, automatic goals.
    await on('2026-09-20', async () => {
      const profile = await services.profile.ensureLocalProfile();
      await services.profile.updateBodyData(profile, {
        sex: 'male',
        birthDate: '1990-05-01',
        heightCm: 177,
      });
      for (const date of days('2026-09-14', '2026-09-20')) {
        await services.weight.save(profileId, date, 90);
      }
      await services.nutrition.goals.saveProfile(profileId, {
        params: {
          goalType: 'maintain',
          goalLevel: 'moderate',
          activityLevel: 'moderate',
          includeTraining: false,
          targetWeightKg: null,
        },
        overrides: {},
        waterMl: null,
      });
    });
    const goals = services.nutrition.goals;
    const before = (await goals.goalFor(profileId, '2026-09-30'))?.effective.energyKcal.value;
    expect(before).toBeGreaterThan(0);

    // Today: the height is corrected in Einstellungen → Profil – the app refreshes the goals.
    const profile = await services.profile.ensureLocalProfile();
    await services.profile.updateBodyData(profile, { ...profile, heightCm: 190 });
    expect(await goals.refreshAutomatic(profileId)).toBe('updated');
    const after = (await goals.goalFor(profileId, TODAY))?.effective.energyKcal.value;
    expect(after).toBeGreaterThan(before ?? 0);

    // Past days keep the goal that applied then – in the diary and in progress.
    expect((await goals.dayGoal(profileId, '2026-09-30'))?.effective.energyKcal.value).toBe(before);
    const dayGoals = await goals.dayGoalsBetween(profileId, WEEK);
    expect(dayGoals.slice(0, -1).every((day) => day.energyKcal === before)).toBe(true);
    expect(dayGoals.at(-1)?.energyKcal).toBe(after);
    await eat(s, '2026-09-30', 2000, 150);
    await eat(s, TODAY, 2000, 150);
    const summary = summarizeNutrition(
      await services.nutrition.diary.dailyTotalsBetween(profileId, WEEK[0] ?? '', TODAY),
      dayGoals,
      WEEK,
    );
    expect(summary.avgGoalKcal).toBe(Math.round(((before ?? 0) + (after ?? 0)) / 2));

    // A second refresh without a new input stores nothing.
    expect(await goals.refreshAutomatic(profileId)).toBe('unchanged');
    expect((await goals.list(profileId)).map((goal) => goal.effectiveFrom).sort()).toEqual([
      '2026-09-20',
      TODAY,
    ]);
  });
});

describe('B · training goal: change, history, score', () => {
  it('several changes over 30 days, same day replaced, back to an earlier value', async () => {
    const s = await setup();
    const { services, profileId } = s;
    const targets = services.targets;
    await on('2026-09-01', () => targets.set(profileId, 'trainingsPerWeek', 3));
    // Tuesday 15 September (mid-week): 5; changed twice that day – the last choice counts.
    await on('2026-09-15', () => targets.set(profileId, 'trainingsPerWeek', 4));
    await on('2026-09-15', () => targets.set(profileId, 'trainingsPerWeek', 5));
    // Back to 3 from 22 September.
    await on('2026-09-22', () => targets.set(profileId, 'trainingsPerWeek', 3));
    const versions = (await targets.history(profileId)).trainingsPerWeek;
    expect(versions.map((v) => [v.effectiveFrom, v.value])).toEqual([
      ['2026-09-01', 3],
      ['2026-09-15', 5],
      ['2026-09-22', 3],
    ]);

    for (const day of [5, 9, 16, 17, 18, 23, 26, 30]) await workout(s, new Date(2026, 8, day, 7));
    await workout(s, new Date(2026, 9, 2, 7));
    const month = days('2026-09-04', TODAY);
    expect(month).toHaveLength(30);
    const score = await services.score.calculate(profileId, month, options);
    // 11 days at 3/week + 7 days at 5/week + 12 days at 3/week = 33/7 + 35/7 + 36/7 = 14.9.
    expect(score.areas.training.detail).toMatchObject({ expected: 14.9, done: 9, target: 3 });
    expect(score.areas.training.score).toBe(61); // 9 / 14.857 = 60.6 %

    // A change today alters neither the past month nor last week's score.
    const lastWeek = days('2026-09-14', '2026-09-20');
    const weekBefore = await services.score.calculate(profileId, lastWeek, options);
    await targets.set(profileId, 'trainingsPerWeek', 7);
    expect((await services.score.calculate(profileId, lastWeek, options)).areas.training).toEqual(
      weekBefore.areas.training,
    );
    expect(
      (await services.score.calculate(profileId, days('2026-09-03', '2026-10-02'), options)).areas
        .training.detail.expected,
    ).toBe(14.9);
  });
});

describe('C · activity goal', () => {
  it('counts each session once, never a Kalethra workout, judged by the goal of each day', async () => {
    const s = await setup();
    const { services, profileId, platform } = s;
    await on('2026-09-01', () => services.targets.set(profileId, 'activeMinutesPerWeek', 150));
    platform.workouts = [
      hc('run', 1, 7, 60, 500), // counts
      hc('gym', 2, 18, 60, 400), // the same session as a Kalethra workout → training only
    ];
    await services.healthSync.connect(profileId);
    await workout(s, new Date(2026, 9, 2, 18));
    await services.activities.create(profileId, manual('2026-10-01', '07:00', 60, 480)); // duplicate
    await services.activities.create(profileId, manual('2026-09-30', null, 30, 150, 'yoga'));

    const score = await services.score.calculate(profileId, WEEK, options);
    expect(score.areas.activity.detail).toMatchObject({ minutes: 90, expectedMinutes: 150 });
    expect(score.areas.activity.score).toBe(60);
    expect(score.areas.training.detail.done).toBe(1);

    // A new goal today leaves the week unchanged.
    await services.targets.set(profileId, 'activeMinutesPerWeek', 300);
    const lastWeek = days('2026-09-26', '2026-10-02');
    const again = await services.score.calculate(profileId, lastWeek, options);
    expect(again.areas.activity.detail).toMatchObject({ expectedMinutes: 150 });
  });
});

describe('D · step goal', () => {
  it('rates steps from Health Connect against each day’s goal – inside the activity area only', async () => {
    const s = await setup();
    const { services, profileId, platform } = s;
    await fixedGoal(s);
    await eat(s, '2026-10-01', 2300, 160);
    await services.recovery.save(profileId, TODAY, { state: 'good', restDay: false });
    const total = (day: number, value: number) => ({
      dayStart: localIso(2026, 10, day),
      value,
    });
    platform.steps = [total(1, 9000), total(2, 6500), total(3, 4000)];
    await services.healthSync.connect(profileId);
    const before = await services.score.calculate(profileId, WEEK, options);

    await on('2026-09-01', () => services.targets.set(profileId, 'stepsPerDay', 6000));
    await on('2026-10-02', () => services.targets.set(profileId, 'stepsPerDay', 8000));
    const versions = (await services.targets.history(profileId)).stepsPerDay;
    const stepDays = (
      await services.healthSync.activityBetween(profileId, WEEK[0] ?? '', TODAY)
    ).map((day) => ({ date: day.date, steps: day.steps }));
    const summary = summarizeStepGoal(stepDays, WEEK, (date) => targetOn(versions, date));
    // 1 Oct: 9000 ≥ 6000 ✓, 2 Oct: 6500 < 8000 ✗, 3 Oct: 4000 < 8000 ✗; other days unknown.
    expect(summary).toMatchObject({ ratedDays: 3, reachedDays: 1 });
    expect(summary.today).toEqual({ steps: 4000, goal: 8000, ratio: 0.5 });

    const after = await services.score.calculate(profileId, WEEK, options);
    // Since the Phase 14 follow-up, steps are a signal inside "Aktivitäten" (no area of its own):
    // 1 Oct 100, 2 Oct 6.500 / 8.000 → 81,25; today (4.000 < 8.000) still open → (100 + 81,25) / 2.
    expect(before.areas.activity.score).toBeNull();
    expect(after.areas.activity.score).toBe(91);
    expect(after.areas.activity.detail.steps).toMatchObject({
      target: 8000,
      ratedDays: 2,
      reachedDays: 1,
    });
    // Everything else stays exactly as it was – same areas, same weights.
    expect(after.areas.nutrition).toEqual(before.areas.nutrition);
    expect(after.areas.training).toEqual(before.areas.training);
    expect(after.areas.recovery).toEqual(before.areas.recovery);
    expect(after.weights).toEqual(before.weights);
    expect(Object.keys(after.areas)).toEqual(['nutrition', 'training', 'activity', 'recovery']);
  });
});

describe('E · recipe → diary → progress and score', () => {
  it('logged servings keep their values when the recipe is edited or deleted', async () => {
    const s = await setup();
    const { services, profileId } = s;
    const n = services.nutrition;
    await fixedGoal(s, 2000, 100);
    const oats = await food(s, 'Hafer', 370, 13);
    const milk = await food(s, 'Milch', 64, 3.4);
    const recipe = await n.recipes.create(profileId, {
      name: 'Porridge',
      servings: 2,
      ingredients: [
        { foodId: oats.id, amount: 100, unit: 'g' },
        { foodId: milk.id, amount: 500, unit: 'g' },
      ],
    });
    const perServing = (await n.recipes.nutrition(profileId, recipe.id)).perServing.totals;
    // (370 + 320) / 2 = 345 kcal per serving.
    expect(perServing.energyKcal).toBe(345);
    await n.diary.addRecipe(profileId, {
      recipeId: recipe.id,
      servings: 1.5,
      localDate: '2026-10-01',
      mealId: await firstMeal(s),
    });
    const totals = () => n.diary.dailyTotalsBetween(profileId, WEEK[0] ?? '', TODAY);
    const logged = await totals();
    expect(logged).toEqual([
      expect.objectContaining({ localDate: '2026-10-01', energyKcal: 517.5 }),
    ]);
    const score = await services.score.calculate(profileId, WEEK, options);

    // Editing the recipe changes future servings only.
    await n.recipes.update(profileId, recipe.id, {
      name: 'Porridge groß',
      servings: 1,
      ingredients: [{ foodId: oats.id, amount: 200, unit: 'g' }],
    });
    expect(await totals()).toEqual(logged);
    const [entry] = (await n.diary.getDay(profileId, '2026-10-01')).entries;
    expect(entry).toMatchObject({ name: 'Porridge', amount: 1.5, unit: 'serving' });

    // Deleting it keeps the logged day, its progress and its score.
    await n.recipes.delete(profileId, recipe.id);
    expect(await totals()).toEqual(logged);
    expect(await services.score.calculate(profileId, WEEK, options)).toEqual(score);
    const summary = summarizeNutrition(
      await totals(),
      await n.goals.dayGoalsBetween(profileId, WEEK),
      WEEK,
    );
    expect(summary).toMatchObject({ loggedDays: 1, avgKcal: 518, avgGoalKcal: 2000 });
  });
});

describe('F · template → diary', () => {
  it('logged items keep their values when the template is edited or deleted', async () => {
    const s = await setup();
    const { services, profileId } = s;
    const n = services.nutrition;
    const bread = await food(s, 'Brot', 250, 9);
    const cheese = await food(s, 'Käse', 350, 25);
    const template = await n.meals.saveMeal(profileId, {
      name: 'Abendbrot',
      items: [
        { foodId: bread.id, amount: 100, unit: 'g' },
        { foodId: cheese.id, amount: 40, unit: 'g' },
      ],
    });
    // Adjusted only for this day: less bread – the template stays as saved.
    await n.diary.addSavedMeal(profileId, {
      savedMealId: template.id,
      localDate: '2026-10-02',
      mealId: await firstMeal(s),
      items: [
        { foodId: bread.id, amount: 80, unit: 'g' },
        { foodId: cheese.id, amount: 40, unit: 'g' },
      ],
    });
    expect((await n.meals.getSavedMeal(profileId, template.id)).items[0]).toMatchObject({
      amount: 100,
    });
    const day = async () => (await n.diary.getDay(profileId, '2026-10-02')).entries;
    const logged = await day();
    expect(logged.map((e) => [e.name, e.amount, e.nutrients.energyKcal])).toEqual([
      ['Brot', 80, 200],
      ['Käse', 40, 140],
    ]);

    await n.meals.updateSavedMeal(profileId, template.id, {
      name: 'Abendbrot leicht',
      items: [{ foodId: cheese.id, amount: 20, unit: 'g' }],
    });
    expect(await day()).toEqual(logged);
    await n.meals.deleteSavedMeal(profileId, template.id);
    expect(await day()).toEqual(logged);
    // The food behind an entry can be hidden; the entry keeps its snapshot.
    await n.foods.setActive(profileId, bread.id, false);
    expect(await day()).toEqual(logged);
  });
});

describe('G · weight sources (three rules, one source each)', () => {
  it('goals read own entries only, the display merges both, activities use the newest value', async () => {
    const s = await setup();
    const { services, profileId, platform } = s;
    const sample = (day: number, kg: number) => ({
      id: `w${day}`,
      measuredAt: localIso(2026, 10, day, 7),
      kg,
      source: 'Waage',
    });
    await on('2026-09-25', async () => {
      const profile = await services.profile.ensureLocalProfile();
      await services.profile.updateBodyData(profile, {
        sex: 'female',
        birthDate: '1992-03-01',
        heightCm: 168,
      });
      await services.weight.save(profileId, '2026-09-25', 70);
      await services.nutrition.goals.saveProfile(profileId, {
        params: {
          goalType: 'maintain',
          goalLevel: 'moderate',
          activityLevel: 'light',
          includeTraining: false,
          targetWeightKg: null,
        },
        overrides: {},
        waterMl: null,
      });
    });
    await services.weight.save(profileId, '2026-10-01', 70.4);
    platform.weights = [sample(1, 75), sample(2, 76)];
    await services.healthSync.connect(profileId);

    // Rule 1: imported weights never change a nutrition goal.
    const goal = await services.nutrition.goals.goalFor(profileId, TODAY);
    expect(await services.nutrition.goals.refreshAutomatic(profileId)).toBe('unchanged');
    expect(await services.nutrition.goals.goalFor(profileId, TODAY)).toEqual(goal);

    // Rule 2: one value per day for display, the own entry wins on the same day.
    const own = (await services.weight.listBetween(profileId, '2026-09-25', TODAY)).map((e) => ({
      date: e.date,
      kg: e.kg,
    }));
    const imported = await services.healthSync.weightsBetween(profileId, '2026-09-25', TODAY);
    expect(mergeWeightDays(own, imported)).toEqual([
      { date: '2026-09-25', kg: 70, source: 'own' },
      { date: '2026-10-01', kg: 70.4, source: 'own' },
      { date: '2026-10-02', kg: 76, source: 'imported' },
    ]);

    // Rule 3: an activity uses the newest value – here the import of 2 October – as snapshot.
    const activity = await services.activities.create(
      profileId,
      manual(TODAY, null, 60, null, 'yoga'),
    );
    expect(activity.weightKg).toBe(76);
    await services.weight.save(profileId, TODAY, 70.2);
    const later = await services.activities.create(
      profileId,
      manual(TODAY, null, 60, null, 'yoga'),
    );
    expect(later.weightKg).toBe(70.2);
    // The first activity keeps its snapshot.
    const stored = await services.activities.listBetween(profileId, TODAY, TODAY);
    expect(stored.find((a) => a.id === activity.id)?.weightKg).toBe(76);
  });
});

describe('H · activity sources (Health Connect, manual, Kalethra)', () => {
  it('every reader applies the same rules: no double counting, workouts only as training', async () => {
    const s = await setup();
    const { services, profileId, platform } = s;
    await fixedGoal(s);
    await on('2026-09-01', async () => {
      await services.targets.set(profileId, 'activityCalories', 1);
      await services.targets.set(profileId, 'activeMinutesPerWeek', 150);
      await services.targets.set(profileId, 'trainingsPerWeek', 2);
    });
    platform.workouts = [
      hc('run', 1, 7, 45, 500), // counts
      hc('strength', 1, 18, 60, 350), // = the Kalethra workout below
    ];
    await services.healthSync.connect(profileId);
    await workout(s, new Date(2026, 9, 1, 18), 60);
    await services.activities.create(profileId, manual('2026-10-01', '07:05', 40, 450)); // duplicate
    await services.activities.create(profileId, manual('2026-10-01', null, 30, 120, 'yoga'));

    // Calorie budget of the day: 500 + 120 counted, the duplicate and the workout excluded.
    const day = await services.nutrition.goals.dayGoal(profileId, '2026-10-01');
    expect(day?.activity).toEqual({ kcal: 620, counted: true, baseKcal: 2300, excluded: 2 });
    expect(day?.effective.energyKcal.value).toBe(2920);
    const [range] = await services.nutrition.goals.dayGoalsBetween(profileId, ['2026-10-01']);
    expect(range?.energyKcal).toBe(2920);

    // Score: 75 active minutes, the Kalethra workout once – as training.
    const score = await services.score.calculate(profileId, WEEK, options);
    expect(score.areas.activity.detail).toMatchObject({ minutes: 75 });
    expect(score.areas.training.detail.done).toBe(1);

    // Progress card: the same two sessions.
    const imported = await services.healthSync.workoutsBetween(profileId, WEEK[0] ?? '', TODAY);
    const manualList = await services.activities.listBetween(profileId, WEEK[0] ?? '', TODAY);
    const own = await services.training.workouts.completedSpansBetween(
      profileId,
      '2026-09-26',
      '2026-10-04',
    );
    const card = summarizeAllActivities(combineActivities(imported, manualList), WEEK, own);
    expect(card).toMatchObject({ count: 2, activeKcal: 620, activeDays: 1 });
    expect(card.durationS).toBe(75 * 60);
  });
});
