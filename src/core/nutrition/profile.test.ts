import { createServices, loadInitialState, type AppServices } from '@/app/services';
import { migrate, migrations } from '@/core/database';
import { openSqlJsDriver } from '@/core/database/drivers/sqlJs';
import { BodyDataError } from '@/core/user';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import type { NutritionProfileInput } from './goalService';

let now = new Date(2026, 9, 1, 9, 0);
const clock = () => now;
const at = (day: number, month = 9) => {
  now = new Date(2026, month, day, 9, 0);
};

async function setup() {
  at(1);
  const db = await createTestDatabase();
  const services = createServices({ driver: db, security: ENCRYPTED_TEST_SECURITY }, clock);
  const profile = await services.profile.ensureLocalProfile();
  await services.profile.updateBodyData(profile, {
    sex: 'male',
    birthDate: '1990-05-01',
    heightCm: 180,
  });
  return { db, services, profileId: profile.id };
}

/** One weighing per day for `days` days ending today. */
async function weighDaily(s: AppServices, profileId: string, kg: number, days = 7) {
  const today = now;
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = `${String(day.getFullYear())}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    await s.weight.save(profileId, key, kg);
  }
}

const loseModerate: NutritionProfileInput = {
  params: {
    goalType: 'lose',
    goalLevel: 'moderate',
    activityLevel: 'moderate',
    includeTraining: false,
    targetWeightKg: 82,
  },
  overrides: {},
  waterMl: 2500,
};

describe('nutrition profile', () => {
  it('calculates and stores the goal with its full explanation', async () => {
    const { services, profileId } = await setup();
    await weighDaily(services, profileId, 90);
    const goal = await services.nutrition.goals.saveProfile(profileId, loseModerate);

    // RMR 10·90 + 6.25·180 − 5·36 + 5 = 1850; × 1.4 = 2590; − 550 = 2040
    expect(goal.targets.energyKcal).toEqual({ auto: 2040, manual: null });
    expect(goal.targets.waterMl).toEqual({ auto: null, manual: 2500 });
    expect(goal.autoEnabled).toBe(true);
    expect(goal.calculation?.energy?.rmrKcal).toBe(1850);
    expect(goal.calculation?.inputs).toMatchObject({ ageYears: 36, heightCm: 180, sex: 'male' });
    expect(goal.calculation?.inputs.weight).toMatchObject({ kg: 90, method: 'median7' });

    const day = await services.nutrition.goals.goalFor(profileId, '2026-10-01');
    expect(day?.effective.energyKcal).toEqual({ value: 2040, origin: 'auto' });
    expect(day?.goal.calculation?.energy?.adjustment.appliedKcal).toBe(-550);
  });

  it('works without weight: values can be set manually and nothing is invented', async () => {
    const { services, profileId } = await setup();
    const goal = await services.nutrition.goals.saveProfile(profileId, {
      ...loseModerate,
      overrides: { energyKcal: 2100 },
    });
    expect(goal.calculation?.missing).toEqual(['weight']);
    expect(goal.targets.energyKcal).toEqual({ auto: null, manual: 2100 });
    expect(goal.targets.proteinG.auto).toBeNull();
  });

  it('follows the weight trend but not a single weighing', async () => {
    const { services, profileId } = await setup();
    const goals = services.nutrition.goals;
    await weighDaily(services, profileId, 90);
    await goals.saveProfile(profileId, loseModerate);

    // One unusual reading a day later: the 7-day median does not move.
    at(2);
    await services.weight.save(profileId, '2026-10-02', 93);
    expect(await goals.refreshAutomatic(profileId)).toBe('unchanged');
    expect(await goals.list(profileId)).toHaveLength(1);

    // A week of lower weights: a new version starts on that day.
    at(9);
    await weighDaily(services, profileId, 87);
    expect(await goals.refreshAutomatic(profileId)).toBe('updated');
    const versions = await goals.list(profileId);
    expect(versions.map((v) => v.effectiveFrom)).toEqual(['2026-10-01', '2026-10-09']);
    expect(versions[1]?.targets.energyKcal.auto).toBe(2000); // (1820 · 1.4 = 2548) − 550
    // Earlier days keep the goal that applied then.
    expect((await goals.goalFor(profileId, '2026-10-05'))?.effective.energyKcal.value).toBe(2040);
  });

  it('keeps manual values when the weight changes and restores automatic ones on request', async () => {
    const { services, profileId } = await setup();
    const goals = services.nutrition.goals;
    await weighDaily(services, profileId, 90);
    await goals.saveProfile(profileId, { ...loseModerate, overrides: { proteinG: 170 } });

    at(9);
    await weighDaily(services, profileId, 87);
    await goals.refreshAutomatic(profileId);
    const today = await goals.goalFor(profileId, '2026-10-09');
    expect(today?.effective.proteinG).toEqual({ value: 170, origin: 'manual' });
    expect(today?.effective.energyKcal.value).toBe(2000);

    await goals.saveProfile(profileId, { ...loseModerate, overrides: {} });
    const auto = await goals.goalFor(profileId, '2026-10-09');
    expect(auto?.effective.proteinG.origin).toBe('auto');
    expect(auto?.effective.proteinG.value).toBe(Math.round(87 * 1.6));
  });

  it('starts a new version on a goal change and keeps the old days', async () => {
    const { services, profileId } = await setup();
    const goals = services.nutrition.goals;
    await weighDaily(services, profileId, 90);
    await goals.saveProfile(profileId, loseModerate);
    at(1, 10); // 1 November
    await goals.saveProfile(profileId, {
      ...loseModerate,
      params: { ...loseModerate.params, goalType: 'gain', goalLevel: 'moderate' },
    });

    const october = await goals.goalFor(profileId, '2026-10-15');
    const november = await goals.goalFor(profileId, '2026-11-02');
    expect(october?.goal.goalType).toBe('lose');
    expect(october?.effective.energyKcal.value).toBe(2040);
    expect(november?.goal.goalType).toBe('gain');
    expect(november?.goal.goalLevel).toBe('moderate');
    // Trend from 1 October is no longer recent: the latest value is used openly.
    expect(november?.goal.calculation?.warnings).toContain('weight-not-recent');
  });

  it('replaces a version saved earlier on the same day', async () => {
    const { services, profileId } = await setup();
    const goals = services.nutrition.goals;
    await goals.saveProfile(profileId, loseModerate);
    await goals.saveProfile(profileId, { ...loseModerate, waterMl: 3000 });
    expect(await goals.list(profileId)).toHaveLength(1);
  });

  it('counts training only when included and uses real workouts', async () => {
    const { services, profileId } = await setup();
    const goals = services.nutrition.goals;
    await weighDaily(services, profileId, 90);
    for (const day of [5, 8, 12, 20]) {
      at(day, 8); // September
      const workout = await services.training.workouts.startFree(profileId);
      now = new Date(2026, 8, day, 10, 0);
      await services.training.workouts.finish(profileId, workout.id);
    }
    at(1);
    const without = await goals.calculate(profileId, loseModerate.params, {});
    const withTraining = await goals.calculate(
      profileId,
      { ...loseModerate.params, includeTraining: true },
      {},
    );
    expect(without.energy?.training).toBeNull();
    expect(withTraining.energy?.training?.sessions).toBe(4);
    // 4 × 60 min strength: (3.5 − 1) × 90 kg × 4 h ÷ 28 ≈ 32 kcal/day
    expect(withTraining.energy?.training?.kcalPerDay).toBeCloseTo(900 / 28);
    expect(withTraining.protein?.basis).toBe('strength');
    expect(without.protein?.basis).toBe('strength');
  });

  it('rejects implausible profile values', async () => {
    const { services, profileId } = await setup();
    const goals = services.nutrition.goals;
    await expect(
      goals.saveProfile(profileId, {
        ...loseModerate,
        params: { ...loseModerate.params, targetWeightKg: 10 },
      }),
    ).rejects.toThrow();
    await expect(
      goals.saveProfile(profileId, { ...loseModerate, overrides: { energyKcal: 100 } }),
    ).rejects.toThrow();
    const profile = await services.profile.ensureLocalProfile();
    await expect(
      services.profile.updateBodyData(profile, {
        sex: 'male',
        birthDate: '2030-01-01',
        heightCm: 180,
      }),
    ).rejects.toBeInstanceOf(BodyDataError);
    await expect(
      services.profile.updateBodyData(profile, { sex: 'male', birthDate: null, heightCm: 20 }),
    ).rejects.toBeInstanceOf(BodyDataError);
  });

  it('refreshes automatic goals at app start', async () => {
    const { services, profileId } = await setup();
    await weighDaily(services, profileId, 90);
    await services.nutrition.goals.saveProfile(profileId, loseModerate);
    at(9);
    await weighDaily(services, profileId, 86);
    await loadInitialState(services);
    expect((await services.nutrition.goals.list(profileId)).map((g) => g.effectiveFrom)).toEqual([
      '2026-10-01',
      '2026-10-09',
    ]);
  });
});

describe('migration 7', () => {
  it('keeps existing goals as manual goals and adds the profile columns', async () => {
    const db = await openSqlJsDriver();
    await migrate(
      db,
      migrations.filter((m) => m.version <= 6),
    );
    await db.run(
      `INSERT INTO profiles (id, display_name, created_at, updated_at) VALUES ('p', 'A', 'x', 'x')`,
    );
    await db.run(
      `INSERT INTO nutrition_goals (id, profile_id, effective_from, goal_type, energy_kcal_manual,
         protein_g_auto, created_at, updated_at)
       VALUES ('g', 'p', '2026-09-01', 'lose', 2100, 150, 'x', 'x')`,
    );
    expect(await migrate(db, migrations)).toEqual([7, 8, 9, 10, 11, 12, 13]);

    const services = createServices({ driver: db, security: ENCRYPTED_TEST_SECURITY }, clock);
    const [goal] = await services.nutrition.goals.list('p');
    expect(goal).toMatchObject({
      goalType: 'lose',
      autoEnabled: false,
      includeTraining: false,
      calculation: null,
      goalLevel: null,
    });
    expect(goal?.targets.energyKcal).toEqual({ auto: null, manual: 2100 });
    expect(goal?.targets.proteinG).toEqual({ auto: 150, manual: null });
    expect(await services.profile.getBodyData('p')).toEqual({
      sex: null,
      birthDate: null,
      heightCm: null,
    });
    // Old manual goals are not recalculated automatically.
    expect(await services.nutrition.goals.refreshAutomatic('p')).toBe('none');
  });
});
