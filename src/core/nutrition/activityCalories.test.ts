import { createServices } from '@/app/services';
import type { HealthWorkout } from '@/core/platform/health';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import { withActivityCalories, type GoalForDay } from './goalService';
import type { NutritionProfileInput } from './goalService';

// Saturday, 3 October 2026, 10:00 local time.
let now = new Date(2026, 9, 3, 10, 0);
const clock = () => now;
const TODAY = '2026-10-03';

async function setup(db?: Awaited<ReturnType<typeof createTestDatabase>>) {
  const database = db ?? (await createTestDatabase());
  const platform = new FakeHealthPlatform();
  const services = createServices(
    { driver: database, security: ENCRYPTED_TEST_SECURITY },
    clock,
    undefined,
    undefined,
    platform,
  );
  const profile = await services.profile.ensureLocalProfile();
  return { db: database, platform, services, profileId: profile.id };
}

type Context = Awaited<ReturnType<typeof setup>>;

/** A fixed daily goal of 2300 kcal (the user's own values). */
async function withGoal({ services, profileId }: Context) {
  await services.nutrition.goals.save(profileId, {
    effectiveFrom: '2026-09-01',
    goalType: 'maintain',
    targets: {
      energyKcal: { auto: null, manual: 2300 },
      proteinG: { auto: null, manual: 160 },
      fatG: { auto: null, manual: 75 },
      carbsG: { auto: null, manual: 250 },
    },
  });
}

/** A Health Connect activity today. */
function activity(
  id: string,
  [hour, minute]: [number, number],
  minutes: number,
  kcal: number | null,
): HealthWorkout {
  const start = localIso(2026, 10, 3, hour, minute);
  return {
    id,
    type: 'running',
    start,
    end: new Date(Date.parse(start) + minutes * 60_000).toISOString(),
    activeKcal: kcal,
    distanceM: 5000,
    source: 'Pixel Watch',
  };
}

const dayGoal = ({ services, profileId }: Context, countActivity: boolean) =>
  services.nutrition.goals.dayGoal(profileId, TODAY, { countActivity });

const energy = (day: GoalForDay | null) => day?.effective.energyKcal.value;
const macros = (day: GoalForDay | null) => ({
  protein: day?.effective.proteinG,
  fat: day?.effective.fatG,
  carbs: day?.effective.carbsG,
});

async function storedEnergyTargets({ db }: Context) {
  return db.query('SELECT * FROM nutrition_goals');
}

beforeEach(() => {
  now = new Date(2026, 9, 3, 10, 0);
});

describe('activity calories and the daily goal', () => {
  it('1 · off (default): the goal stays 2300 kcal, the 500 kcal are information only', async () => {
    const context = await setup();
    await withGoal(context);
    context.platform.workouts = [activity('a', [7, 0], 45, 500)];
    await context.services.healthSync.connect(context.profileId);
    expect((await context.services.settings.load()).countActivityCalories).toBe(false);

    const day = await dayGoal(context, false);
    expect(energy(day)).toBe(2300);
    expect(day?.effective.energyKcal.origin).toBe('manual');
    expect(day?.activity).toEqual({ kcal: 500, counted: false, baseKcal: 2300, excluded: 0 });
  });

  it('2 · on: 2300 + 500 = 2800 kcal for the day, the stored base goal is untouched', async () => {
    const context = await setup();
    await withGoal(context);
    context.platform.workouts = [activity('a', [7, 0], 45, 500)];
    await context.services.healthSync.connect(context.profileId);
    const before = await storedEnergyTargets(context);

    const day = await dayGoal(context, true);
    expect(energy(day)).toBe(2800);
    expect(day?.activity).toEqual({ kcal: 500, counted: true, baseKcal: 2300, excluded: 0 });
    expect(await storedEnergyTargets(context)).toEqual(before);
    expect(energy(await context.services.nutrition.goals.goalFor(context.profileId, TODAY))).toBe(
      2300,
    );
  });

  it('3 · no activities: the goal stays 2300 kcal and nothing is added', async () => {
    const context = await setup();
    await withGoal(context);
    await context.services.healthSync.connect(context.profileId);
    const day = await dayGoal(context, true);
    expect(energy(day)).toBe(2300);
    expect(day?.activity).toBeUndefined();
  });

  it('4 · several activities are added up; ones without energy add nothing', async () => {
    const context = await setup();
    await withGoal(context);
    context.platform.workouts = [
      activity('a', [6, 0], 30, 250),
      activity('b', [7, 0], 20, 180.4),
      activity('c', [8, 0], 20, null),
    ];
    await context.services.healthSync.connect(context.profileId);
    const day = await dayGoal(context, true);
    expect(energy(day)).toBe(2730);
    expect(day?.activity).toMatchObject({ kcal: 430, counted: true });
  });

  it('5 · the setting survives a restart', async () => {
    const context = await setup();
    await withGoal(context);
    context.platform.workouts = [activity('a', [7, 0], 45, 500)];
    await context.services.healthSync.connect(context.profileId);
    await context.services.settings.update('countActivityCalories', true);

    const restarted = await setup(context.db);
    const settings = await restarted.services.settings.load();
    expect(settings.countActivityCalories).toBe(true);
    expect(energy(await dayGoal(restarted, settings.countActivityCalories))).toBe(2800);
  });

  it('6 · a later sync with a new activity raises the budget of the day', async () => {
    const context = await setup();
    await withGoal(context);
    context.platform.workouts = [activity('a', [7, 0], 45, 500)];
    await context.services.healthSync.connect(context.profileId);
    expect(energy(await dayGoal(context, true))).toBe(2800);

    now = new Date(2026, 9, 3, 19, 0);
    context.platform.workouts = [activity('a', [7, 0], 45, 500), activity('b', [17, 30], 60, 320)];
    await context.services.healthSync.sync(context.profileId, { manual: true });
    expect(energy(await dayGoal(context, true))).toBe(3120);

    // Deleted in Health Connect → no longer counted after the next complete sync.
    context.platform.workouts = [activity('b', [17, 30], 60, 320)];
    await context.services.healthSync.sync(context.profileId, { manual: true });
    expect(energy(await dayGoal(context, true))).toBe(2620);
  });

  it('7 · a weight change recalculates only the base goal; the bonus is added on top', async () => {
    const context = await setup();
    const { services, profileId } = context;
    await services.profile.updateBodyData(await services.profile.ensureLocalProfile(), {
      sex: 'male',
      birthDate: '1990-05-01',
      heightCm: 180,
    });
    now = new Date(2026, 8, 25, 9, 0);
    for (let day = 19; day <= 25; day++)
      await services.weight.save(profileId, `2026-09-${String(day)}`, 90);
    const profile: NutritionProfileInput = {
      params: {
        goalType: 'maintain',
        goalLevel: null,
        activityLevel: 'moderate',
        includeTraining: false,
        targetWeightKg: null,
      },
      overrides: {},
      waterMl: null,
    };
    await services.nutrition.goals.saveProfile(profileId, profile);

    now = new Date(2026, 9, 3, 10, 0);
    for (let day = 27; day <= 30; day++)
      await services.weight.save(profileId, `2026-09-${String(day)}`, 80);
    for (let day = 1; day <= 3; day++)
      await services.weight.save(profileId, `2026-10-0${String(day)}`, 80);
    context.platform.workouts = [activity('a', [7, 0], 45, 500)];
    await services.healthSync.connect(profileId);
    expect(await services.nutrition.goals.refreshAutomatic(profileId)).toBe('updated');

    const base = await services.nutrition.goals.goalFor(profileId, TODAY);
    const baseKcal = base?.effective.energyKcal.value ?? 0;
    expect(base?.goal.calculation?.inputs.weight).toMatchObject({ kg: 80 });
    // The stored automatic value is the plain calculation – the bonus is never written into it.
    expect(base?.goal.targets.energyKcal.auto).toBe(baseKcal);
    const day = await dayGoal(context, true);
    expect(energy(day)).toBe(baseKcal + 500);
    expect(day?.activity?.baseKcal).toBe(baseKcal);
  });

  it('8 · protein (also a custom target), fat and carbs stay unchanged', async () => {
    const context = await setup();
    const { services, profileId } = context;
    await services.profile.updateBodyData(await services.profile.ensureLocalProfile(), {
      sex: 'male',
      birthDate: '1990-05-01',
      heightCm: 177,
    });
    for (let day = 27; day <= 30; day++)
      await services.weight.save(profileId, `2026-09-${String(day)}`, 92);
    for (let day = 1; day <= 3; day++)
      await services.weight.save(profileId, `2026-10-0${String(day)}`, 92);
    await services.nutrition.goals.saveProfile(profileId, {
      params: {
        goalType: 'lose',
        goalLevel: 'moderate',
        activityLevel: 'moderate',
        includeTraining: false,
        targetWeightKg: null,
      },
      overrides: {},
      waterMl: 2500,
    });
    await services.nutrition.goals.setProfileOverride(profileId, 'proteinG', 220);
    context.platform.workouts = [activity('a', [7, 0], 45, 500)];
    await services.healthSync.connect(profileId);

    const off = await dayGoal(context, false);
    const on = await dayGoal(context, true);
    expect(on?.effective.proteinG).toEqual({ value: 220, origin: 'manual' });
    expect(energy(on)).toBe((energy(off) ?? 0) + 500);
    expect(macros(on)).toEqual(macros(off));
    expect(on?.effective.waterMl).toEqual(off?.effective.waterMl);
  });

  it('9 · an activity that is the same session as a Kalethra workout is not counted twice', async () => {
    const context = await setup();
    const { services, profileId } = context;
    await withGoal(context);
    // Kalethra workout 07:00–08:00, recorded by the watch as well (07:02–07:58).
    now = new Date(2026, 9, 3, 7, 0);
    const own = await services.training.workouts.startFree(profileId);
    now = new Date(2026, 9, 3, 8, 0);
    await services.training.workouts.finish(profileId, own.id);
    now = new Date(2026, 9, 3, 10, 0);
    context.platform.workouts = [
      { ...activity('watch', [7, 2], 56, 450), type: 'strengthTraining' },
      activity('run', [8, 30], 30, 300),
    ];
    await services.healthSync.connect(profileId);

    const day = await dayGoal(context, true);
    expect(energy(day)).toBe(2600);
    expect(day?.activity).toEqual({ kcal: 300, counted: true, baseKcal: 2300, excluded: 1 });
  });

  it('10 · disconnecting with delete removes the activities and their bonus', async () => {
    const context = await setup();
    await withGoal(context);
    context.platform.workouts = [activity('a', [7, 0], 45, 500)];
    await context.services.healthSync.connect(context.profileId);
    expect(energy(await dayGoal(context, true))).toBe(2800);
    await context.services.healthSync.disconnect(context.profileId, { deleteImported: true });
    const day = await dayGoal(context, true);
    expect(energy(day)).toBe(2300);
    expect(day?.activity).toBeUndefined();
  });

  it('adds nothing without a calorie goal and never invents one', async () => {
    const context = await setup();
    context.platform.workouts = [activity('a', [7, 0], 45, 500)];
    await context.services.healthSync.connect(context.profileId);
    expect(await dayGoal(context, true)).toBeNull();

    const day: GoalForDay = {
      goal: {} as GoalForDay['goal'],
      effective: {
        energyKcal: { value: null, origin: null },
      } as unknown as GoalForDay['effective'],
    };
    const result = withActivityCalories(day, { kcal: 500, excluded: 0 }, true);
    expect(result.effective.energyKcal.value).toBeNull();
    expect(result.activity).toMatchObject({ kcal: 500, counted: false, baseKcal: null });
  });
});
