import { createServices, loadInitialState, type AppServices } from '@/app/services';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import { proteinTarget } from './calculation/macros';
import { goalProgress } from './goals';
import type { NutritionProfileInput } from './goalService';

let now = new Date(2026, 9, 1, 9, 0);
const clock = () => now;
const at = (day: number) => {
  now = new Date(2026, 9, day, 9, 0);
};

const PROFILE: NutritionProfileInput = {
  params: {
    goalType: 'lose',
    goalLevel: 'moderate',
    activityLevel: 'moderate',
    includeTraining: false,
    targetWeightKg: null,
  },
  overrides: {},
  waterMl: null,
};

const key = (date: Date) =>
  `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

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
  if (!db) {
    await services.profile.updateBodyData(profile, {
      sex: 'male',
      birthDate: '1990-05-01',
      heightCm: 177,
    });
  }
  return { db: database, platform, services, profileId: profile.id };
}

/** One weighing per day for the last seven days (one value each, oldest first). */
async function weighWeek(s: AppServices, profileId: string, kgs: number | number[]) {
  const values = Array.isArray(kgs) ? kgs : Array.from({ length: 7 }, () => kgs);
  for (let i = 0; i < values.length; i++) {
    const day = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (values.length - 1 - i),
    );
    await s.weight.save(profileId, key(day), values[i]!);
  }
}

const today = () => key(now);

describe('automatic protein target (unchanged rule: reference weight capped at BMI 27.5)', () => {
  it('177 cm / 92 kg: reference weight ≈ 86.2 kg, capped', async () => {
    at(1);
    const { services, profileId } = await setup();
    await weighWeek(services, profileId, 92);
    const goal = await services.nutrition.goals.saveProfile(profileId, PROFILE);
    const protein = goal.calculation?.protein;
    expect(protein).toMatchObject({ referenceWeightKg: 86.2, referenceCapped: true, gPerKg: 1.6 });
    expect(goal.calculation?.inputs.weight?.kg).toBe(92);
    // 1.6 g × 86.15 kg (27.5 × 1.77²), rounded.
    expect(goal.targets.proteinG.auto).toBe(138);
    expect(goal.targets.proteinG.auto).toBe(
      Math.round(
        proteinTarget({
          weightKg: 92,
          heightCm: 177,
          goalType: 'lose',
          activityLevel: 'moderate',
          regularStrengthTraining: false,
        }).grams,
      ),
    );
  });

  it('177 cm / 75 kg: reference weight = 75 kg, not capped', async () => {
    at(1);
    const { services, profileId } = await setup();
    await weighWeek(services, profileId, 75);
    const goal = await services.nutrition.goals.saveProfile(profileId, PROFILE);
    expect(goal.calculation?.protein).toMatchObject({
      referenceWeightKg: 75,
      referenceCapped: false,
    });
    expect(goal.targets.proteinG.auto).toBe(120);
  });

  it('uses the same weight basis (7-day median) as the other targets', async () => {
    at(1);
    const { services, profileId } = await setup();
    // Median of 70, 71, 72, 73, 74, 75, 90 is 73 – the outlier does not count.
    await weighWeek(services, profileId, [90, 70, 71, 72, 73, 74, 75]);
    const goal = await services.nutrition.goals.saveProfile(profileId, PROFILE);
    expect(goal.calculation?.inputs.weight).toMatchObject({ kg: 73, method: 'median7' });
    expect(goal.calculation?.protein?.referenceWeightKg).toBe(73);
    expect(goal.targets.proteinG.auto).toBe(Math.round(73 * 1.6));
    // RMR 10·73 + 6.25·177 − 5·36 + 5 = 1661.25 – energy uses the same 73 kg.
    expect(goal.calculation?.energy?.rmrKcal).toBeCloseTo(1661.25);
  });

  it('follows a new weight below the cap', async () => {
    at(1);
    const { services, profileId } = await setup();
    await weighWeek(services, profileId, 86.2);
    await services.nutrition.goals.saveProfile(profileId, PROFILE);
    at(9);
    await weighWeek(services, profileId, 70);
    expect(await services.nutrition.goals.refreshAutomatic(profileId)).toBe('updated');
    const day = await services.nutrition.goals.goalFor(profileId, today());
    expect(day?.goal.calculation?.protein?.referenceWeightKg).toBe(70);
    expect(day?.effective.proteinG).toEqual({ value: 112, origin: 'auto' });
  });
});

describe('custom protein target', () => {
  async function withProfile(kg = 92) {
    at(1);
    const context = await setup();
    await weighWeek(context.services, context.profileId, kg);
    await context.services.nutrition.goals.saveProfile(context.profileId, PROFILE);
    return context;
  }

  it('uses the custom value as the daily target and keeps the automatic one alongside', async () => {
    const { services, profileId } = await withProfile();
    const before = await services.nutrition.goals.goalFor(profileId, today());
    const goal = await services.nutrition.goals.setProfileOverride(profileId, 'proteinG', 210);
    expect(goal.targets.proteinG).toEqual({ auto: 138, manual: 210 });
    expect(goal.autoEnabled).toBe(true);
    const day = await services.nutrition.goals.goalFor(profileId, today());
    expect(day?.effective.proteinG).toEqual({ value: 210, origin: 'manual' });
    // Calories are unaffected; fat and carbohydrates follow the 210 g that count.
    expect(day?.effective.energyKcal).toEqual(before?.effective.energyKcal);
    expect(day?.effective.fatG.value).toBeGreaterThan(0);
    expect(day?.effective.carbsG.value).toBeLessThan(before?.effective.carbsG.value ?? 0);
    const energy = day?.effective.energyKcal.value ?? 0;
    const fat = day?.effective.fatG.value ?? 0;
    const carbs = day?.effective.carbsG.value ?? 0;
    expect(Math.abs(210 * 4 + fat * 9 + carbs * 4 - energy)).toBeLessThan(10);
  });

  it('keeps the custom value when the weight changes (92 → 95 kg)', async () => {
    const { services, profileId } = await withProfile();
    await services.nutrition.goals.setProfileOverride(profileId, 'proteinG', 210);
    at(9);
    await weighWeek(services, profileId, 95);
    expect(await services.nutrition.goals.refreshAutomatic(profileId)).toBe('updated');
    const day = await services.nutrition.goals.goalFor(profileId, today());
    expect(day?.goal.calculation?.inputs.weight?.kg).toBe(95);
    expect(day?.effective.proteinG).toEqual({ value: 210, origin: 'manual' });
  });

  it('keeps the custom value after an app restart', async () => {
    const { db, services, profileId } = await withProfile();
    await services.nutrition.goals.setProfileOverride(profileId, 'proteinG', 210);
    at(2);
    const restarted = await setup(db);
    await loadInitialState(restarted.services);
    const day = await restarted.services.nutrition.goals.goalFor(profileId, today());
    expect(day?.effective.proteinG).toEqual({ value: 210, origin: 'manual' });
  });

  it('is not touched by Health Connect weights, steps or active calories', async () => {
    const { platform, services, profileId } = await withProfile();
    await services.nutrition.goals.setProfileOverride(profileId, 'proteinG', 210);
    const before = await services.nutrition.goals.goalFor(profileId, today());
    platform.weights = [
      { id: 'hc', measuredAt: localIso(2026, 10, 1, 7), kg: 120, source: 'Waage' },
    ];
    platform.steps = [{ dayStart: localIso(2026, 10, 1), value: 25_000 }];
    platform.activeEnergy = [{ dayStart: localIso(2026, 10, 1), value: 1500 }];
    expect(await services.healthSync.connect(profileId)).toEqual({
      kind: 'connected',
      result: 'ok',
    });
    expect(await services.nutrition.goals.refreshAutomatic(profileId)).toBe('unchanged');
    const after = await services.nutrition.goals.goalFor(profileId, today());
    expect(after?.effective.proteinG).toEqual({ value: 210, origin: 'manual' });
    expect(after?.goal.targets).toEqual(before?.goal.targets);
    expect(after?.goal.calculation?.inputs.weight?.kg).toBe(92);
  });

  it('returns to the automatic target and follows later weight changes again', async () => {
    const { services, profileId } = await withProfile();
    await services.nutrition.goals.setProfileOverride(profileId, 'proteinG', 210);
    const automatic = await services.nutrition.goals.setProfileOverride(
      profileId,
      'proteinG',
      null,
    );
    expect(automatic.targets.proteinG).toEqual({ auto: 138, manual: null });
    expect(
      (await services.nutrition.goals.goalFor(profileId, today()))?.effective.proteinG,
    ).toEqual({ value: 138, origin: 'auto' });
    at(9);
    await weighWeek(services, profileId, 80);
    await services.nutrition.goals.refreshAutomatic(profileId);
    expect(
      (await services.nutrition.goals.goalFor(profileId, today()))?.effective.proteinG,
    ).toEqual({ value: 128, origin: 'auto' });
  });

  it('keeps other custom values and the goal settings when protein changes', async () => {
    const { services, profileId } = await withProfile();
    await services.nutrition.goals.setProfileOverride(profileId, 'energyKcal', 2300);
    const goal = await services.nutrition.goals.setProfileOverride(profileId, 'proteinG', 210);
    expect(goal.targets.energyKcal.manual).toBe(2300);
    expect(goal).toMatchObject({
      goalType: 'lose',
      goalLevel: 'moderate',
      activityLevel: 'moderate',
    });
  });

  it('accepts generous custom values but rejects extreme ones', async () => {
    const { services, profileId } = await withProfile();
    const goals = services.nutrition.goals;
    for (const value of [30, 210, 250, 400]) {
      await expect(goals.setProfileOverride(profileId, 'proteinG', value)).resolves.toBeTruthy();
    }
    for (const value of [29, 401, Number.NaN]) {
      await expect(goals.setProfileOverride(profileId, 'proteinG', value)).rejects.toThrow();
    }
    expect((await goals.goalFor(profileId, today()))?.goal.targets.proteinG.manual).toBe(400);
  });

  it('needs a saved automatic profile', async () => {
    at(1);
    const { services, profileId } = await setup();
    await expect(
      services.nutrition.goals.setProfileOverride(profileId, 'proteinG', 210),
    ).rejects.toThrow();
  });

  it('tracking is independent of the target: 230 g eaten against 210 g', () => {
    expect(goalProgress(230, 210)).toEqual({ ratio: 1, remaining: 0, over: 20 });
  });
});
