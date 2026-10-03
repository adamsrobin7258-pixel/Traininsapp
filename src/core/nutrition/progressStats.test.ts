import { createServices } from '@/app/services';
import type { HealthWorkout } from '@/core/platform/health';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import { summarizeNutrition } from './progress';

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

async function setup() {
  now = new Date(2026, 9, 3, 10);
  const platform = new FakeHealthPlatform();
  const services = createServices(
    { driver: await createTestDatabase(), security: ENCRYPTED_TEST_SECURITY },
    clock,
    undefined,
    undefined,
    platform,
  );
  const profileId = (await services.profile.ensureLocalProfile()).id;
  const n = services.nutrition;
  await n.meals.ensureDefaults(profileId);
  const [meal] = await n.meals.listActive(profileId);
  const food = await n.foods.create(profileId, {
    name: 'Testessen',
    reference: { amount: 100, unit: 'g' },
    nutrients: {
      energyKcal: 100,
      proteinG: 10,
      carbsG: 10,
      fatG: 2,
      fiberG: null,
      sugarG: null,
      saturatedFatG: null,
    },
  });
  const eat = (localDate: string, grams: number) =>
    n.diary.addFood(profileId, {
      localDate,
      mealId: meal?.id ?? '',
      foodId: food.id,
      amount: grams,
      unit: 'g',
    });
  return { services, platform, profileId, n, eat };
}

/**
 * Switches "Aktivitätskalorien anrechnen" on from `localDate` on – a versioned target since
 * migration 15, so it is set with the clock on that day.
 */
async function countActivityFrom(
  { services, profileId }: Awaited<ReturnType<typeof setup>>,
  localDate: string,
) {
  const today = now;
  const [year, month, day] = localDate.split('-').map(Number);
  now = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 10);
  await services.targets.set(profileId, 'activityCalories', 1);
  now = today;
}

/** Base goal 2300 kcal / 160 g protein from 1 September. */
async function withGoal({ n, profileId }: Awaited<ReturnType<typeof setup>>) {
  await n.goals.save(profileId, {
    effectiveFrom: '2026-09-01',
    goalType: 'maintain',
    targets: {
      energyKcal: { auto: null, manual: 2300 },
      proteinG: { auto: null, manual: 160 },
    },
  });
}

function activity(id: string, day: number, hour: number, minutes: number, kcal: number | null) {
  const start = localIso(2026, 10, day, hour);
  return {
    id,
    type: 'running',
    start,
    end: new Date(Date.parse(start) + minutes * 60_000).toISOString(),
    activeKcal: kcal,
    distanceM: null,
    source: 'Watch',
  } satisfies HealthWorkout;
}

describe('nutrition progress', () => {
  it('sums each logged day once and leaves days without entries out', async () => {
    const context = await setup();
    await context.eat('2026-10-01', 1500);
    await context.eat('2026-10-01', 500);
    await context.eat('2026-10-03', 1200);
    await context.eat('2026-09-20', 3000); // outside the week
    const totals = await context.n.diary.dailyTotalsBetween(
      context.profileId,
      '2026-09-27',
      '2026-10-03',
    );
    expect(totals).toEqual([
      { localDate: '2026-10-01', energyKcal: 2000, proteinG: 200, entries: 2 },
      { localDate: '2026-10-03', energyKcal: 1200, proteinG: 120, entries: 1 },
    ]);
    const summary = summarizeNutrition(totals, [], WEEK);
    // (2000 + 1200) / 2 logged days – not / 7.
    expect(summary).toMatchObject({ loggedDays: 2, avgKcal: 1600, avgProteinG: 160 });
    expect(summary.perDay.map((day) => day.kcal)).toEqual([
      null,
      null,
      null,
      null,
      2000,
      null,
      1200,
    ]);
  });

  it('has no averages without any entry', () => {
    expect(summarizeNutrition([], [], WEEK)).toMatchObject({
      loggedDays: 0,
      avgKcal: null,
      avgProteinG: null,
      avgGoalKcal: null,
    });
  });

  it('compares with the goal of the same days – off: base goal only', async () => {
    const context = await setup();
    await withGoal(context);
    context.platform.workouts = [activity('a', 2, 7, 45, 500)];
    await context.services.healthSync.connect(context.profileId);
    const goals = await context.n.goals.dayGoalsBetween(context.profileId, WEEK);
    expect(goals.find((g) => g.localDate === '2026-10-02')).toEqual({
      localDate: '2026-10-02',
      energyKcal: 2300,
      proteinG: 160,
    });
  });

  it('on: adds 100 % of the activity calories per day, several summed, none → no bonus', async () => {
    const context = await setup();
    await withGoal(context);
    context.platform.workouts = [
      activity('a', 2, 7, 45, 500),
      activity('b', 1, 7, 30, 250),
      activity('c', 1, 18, 20, 120.4),
      activity('d', 1, 20, 20, null),
    ];
    await context.services.healthSync.connect(context.profileId);
    await countActivityFrom(context, '2026-09-01');
    const goals = await context.n.goals.dayGoalsBetween(context.profileId, WEEK);
    const kcal = Object.fromEntries(goals.map((g) => [g.localDate, g.energyKcal]));
    expect(kcal['2026-10-02']).toBe(2800);
    expect(kcal['2026-10-01']).toBe(2670);
    expect(kcal['2026-09-30']).toBe(2300);
    // Protein is never changed by activity calories.
    expect(new Set(goals.map((g) => g.proteinG))).toEqual(new Set([160]));
    // Same values as the daily view uses.
    for (const date of WEEK) {
      const day = await context.n.goals.dayGoal(context.profileId, date);
      expect(day?.effective.energyKcal.value).toBe(kcal[date]);
    }
    // The stored base goal is untouched.
    const stored = await context.n.goals.goalFor(context.profileId, '2026-10-02');
    expect(stored?.effective.energyKcal.value).toBe(2300);
  });

  it('keeps a custom protein target and has null goals before the first goal', async () => {
    const context = await setup();
    await context.services.profile.updateBodyData(
      await context.services.profile.ensureLocalProfile(),
      { sex: 'male', birthDate: '1990-05-01', heightCm: 177 },
    );
    for (const date of ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'])
      await context.services.weight.save(context.profileId, date, 92);
    await context.n.goals.saveProfile(context.profileId, {
      params: {
        goalType: 'lose',
        goalLevel: 'moderate',
        activityLevel: 'moderate',
        includeTraining: false,
        targetWeightKg: null,
      },
      overrides: {},
      waterMl: null,
    });
    await context.n.goals.setProfileOverride(context.profileId, 'proteinG', 220);
    context.platform.workouts = [activity('a', 3, 7, 45, 500)];
    await context.services.healthSync.connect(context.profileId);
    await countActivityFrom(context, '2026-09-01');
    const goals = await context.n.goals.dayGoalsBetween(context.profileId, WEEK);
    // Goals start today (3 October): earlier days have none – not 0.
    expect(goals[0]).toEqual({ localDate: '2026-09-27', energyKcal: null, proteinG: null });
    expect(goals.at(-1)?.proteinG).toBe(220);
  });

  it('averages the goals over the logged days only', () => {
    const summary = summarizeNutrition(
      [
        { localDate: '2026-10-01', energyKcal: 2000, proteinG: 150 },
        { localDate: '2026-10-02', energyKcal: 2600, proteinG: 170 },
      ],
      [
        { localDate: '2026-09-30', energyKcal: 9999, proteinG: 999 }, // not logged
        { localDate: '2026-10-01', energyKcal: 2300, proteinG: 160 },
        { localDate: '2026-10-02', energyKcal: 2800, proteinG: 160 },
      ],
      WEEK,
    );
    expect(summary).toMatchObject({
      avgKcal: 2300,
      avgProteinG: 160,
      avgGoalKcal: 2550,
      avgGoalProteinG: 160,
    });
  });
});
