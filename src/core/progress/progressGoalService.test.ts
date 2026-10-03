import { createServices } from '@/app/services';
import type { ManualActivityInput } from '@/core/activity';
import type { HealthWorkout } from '@/core/platform/health';
import { EMPTY_SET_VALUES } from '@/core/training';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';

// Saturday, 3 October 2026, 10:00 local time.
const NOW = new Date(2026, 9, 3, 10);
let now = NOW;
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

async function setup() {
  now = NOW;
  const platform = new FakeHealthPlatform();
  const services = createServices(
    { driver: await createTestDatabase(), security: ENCRYPTED_TEST_SECURITY },
    clock,
    undefined,
    undefined,
    platform,
  );
  const profileId = (await services.profile.ensureLocalProfile()).id;
  const progress = (dates: readonly string[] = WEEK) =>
    services.progress.calculate(profileId, dates, { today: TODAY });
  const score = (dates: readonly string[] = WEEK) =>
    services.score.calculate(profileId, dates, { today: TODAY });
  return { platform, services, profileId, progress, score };
}

type Setup = Awaited<ReturnType<typeof setup>>;

/** Runs `action` as if it happened at `when` (the clock is moved there and back). */
async function at<T>(when: Date, action: () => Promise<T>): Promise<T> {
  now = when;
  try {
    return await action();
  } finally {
    now = NOW;
  }
}

/** A completed Kalethra workout with one set (80 kg × 8) at the given local time. */
async function workout({ services, profileId }: Setup, start: Date, minutes = 60) {
  const w = services.training.workouts;
  const own = await at(start, () => w.startFree(profileId));
  await services.training.exercises.ensureCatalog();
  const exercise = await w.addExercise(profileId, own.id, 'sys.bench-press');
  const set = (await w.getDetail(profileId, own.id)).exercises.find((e) => e.id === exercise)
    ?.sets[0];
  if (!set) throw new Error('set expected');
  await w.updateSet(profileId, set.id, { ...EMPTY_SET_VALUES, weightKg: 80, reps: 8 }, true);
  await at(new Date(start.getTime() + minutes * 60_000), () => w.finish(profileId, own.id));
  return { id: own.id, setId: set.id };
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

const manual = (patch: Partial<ManualActivityInput> = {}): ManualActivityInput => ({
  sportId: 'yoga',
  localDate: '2026-10-02',
  startTime: null,
  durationMin: 30,
  distanceKm: null,
  intensity: null,
  variant: null,
  kcalOverride: 90,
  ...patch,
});

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

describe('progress goals from the real data (Phase 14)', () => {
  describe('training', () => {
    it('A: counts completed Kalethra workouts against the target from Einstellungen', async () => {
      const s = await setup();
      await at(new Date(2026, 8, 1, 9), () =>
        s.services.targets.set(s.profileId, 'trainingsPerWeek', 4),
      );
      // Health Connect strength session and a manual activity are no training.
      s.platform.workouts = [hc('watch', 'strengthTraining', 30, 7, 50)];
      await s.services.healthSync.connect(s.profileId);
      await s.services.activities.create(
        s.profileId,
        manual({ sportId: 'tennis', variant: 'singles' }),
      );
      expect((await s.progress()).training.goal).toMatchObject({
        mode: 'full',
        done: 0,
        expected: 4,
      });

      await workout(s, new Date(2026, 8, 28, 18));
      await workout(s, new Date(2026, 9, 1, 18));
      await workout(s, new Date(2026, 9, 2, 18));
      const result = await s.progress();
      expect(result.training.goal).toMatchObject({ mode: 'full', done: 3, expected: 4 });
      expect(result.training.goal.mode === 'full' && result.training.goal.attainment.percent).toBe(
        75,
      );
      // The score reads the same workouts: same count, same expectation.
      const score = await s.score();
      expect(score.areas.training.detail).toMatchObject({ done: 3, expected: 4 });
    });

    it('E: a changed target applies from that day on; earlier days keep the old one', async () => {
      const s = await setup();
      await at(new Date(2026, 8, 1, 9), () =>
        s.services.targets.set(s.profileId, 'trainingsPerWeek', 3),
      );
      // Changed on Thursday, 1 October: 27.09.–30.09. keep 3, 01.10.–03.10. use 4.
      await at(new Date(2026, 9, 1, 8), () =>
        s.services.targets.set(s.profileId, 'trainingsPerWeek', 4),
      );
      const result = await s.progress();
      expect(result.training.goal).toMatchObject({ mode: 'full', expected: 3.4, weeklyTarget: 4 });
      // An earlier week is judged by 3 only.
      const before = await s.progress([
        '2026-09-20',
        '2026-09-21',
        '2026-09-22',
        '2026-09-23',
        '2026-09-24',
        '2026-09-25',
        '2026-09-26',
      ]);
      expect(before.training.goal).toMatchObject({ expected: 3, weeklyTarget: 3 });
      expect((await s.score()).areas.training.detail.expected).toBe(3.4);
    });

    it('today: no workout yet is no 0 % – the score does not judge it either', async () => {
      const s = await setup();
      await s.services.targets.set(s.profileId, 'trainingsPerWeek', 4);
      expect((await s.progress([TODAY])).training.goal).toEqual({
        mode: 'short',
        done: 0,
        weeklyTarget: 4,
      });
      expect((await s.score([TODAY])).areas.training.score).toBeNull();
    });

    it('F: correcting a finished workout updates the progress figures', async () => {
      const s = await setup();
      await at(new Date(2026, 8, 1, 9), () =>
        s.services.targets.set(s.profileId, 'trainingsPerWeek', 2),
      );
      // The watch recorded the same session: it belongs to training, not to the activities.
      s.platform.workouts = [hc('watch', 'strengthTraining', 1, 18, 60)];
      await s.services.healthSync.connect(s.profileId);
      const own = await workout(s, new Date(2026, 9, 1, 18));
      await workout(s, new Date(2026, 9, 2, 18));
      let result = await s.progress();
      expect(result.training.goal).toMatchObject({ done: 2 });
      expect(result.training.summary.volumeKg).toBe(1280);
      expect(result.activity.goal).toMatchObject({ mode: 'none', minutes: 0 });

      // A set corrected afterwards: 100 kg × 8 instead of 80 kg × 8.
      await s.services.training.workouts.updateSet(
        s.profileId,
        own.setId,
        { ...EMPTY_SET_VALUES, weightKg: 100, reps: 8 },
        true,
      );
      result = await s.progress();
      expect(result.training.summary.volumeKg).toBe(1440);

      // Deleted: one workout less – and the watch session now counts as an activity.
      await s.services.training.workouts.delete(s.profileId, own.id);
      result = await s.progress();
      expect(result.training.goal).toMatchObject({ done: 1 });
      expect(result.activity.goal).toMatchObject({ mode: 'none', minutes: 60 });
    });
  });

  describe('activities', () => {
    it('B/G: manual and Health Connect minutes, a duplicate once, a Kalethra workout not again', async () => {
      const s = await setup();
      await at(new Date(2026, 8, 1, 9), () =>
        s.services.targets.set(s.profileId, 'activeMinutesPerWeek', 180),
      );
      s.platform.workouts = [
        hc('run', 'running', 1, 7, 45), // counts
        hc('watch-strength', 'strengthTraining', 29, 18, 55), // = the Kalethra workout below
      ];
      await s.services.healthSync.connect(s.profileId);
      await workout(s, new Date(2026, 8, 29, 18));
      // The same run logged by hand → Health Connect wins, it counts once.
      await s.services.activities.create(
        s.profileId,
        manual({ sportId: 'jog', localDate: '2026-10-01', startTime: '07:05', durationMin: 45 }),
      );
      const yoga = await s.services.activities.create(s.profileId, manual());
      let result = await s.progress();
      expect(result.activity.goal).toMatchObject({
        mode: 'full',
        minutes: 75,
        expectedMinutes: 180,
      });
      // Count, duration and kcal follow the same rule: run + yoga.
      expect(result.activity.summary).toMatchObject({ count: 2, durationS: 75 * 60 });
      // Exactly the score's active minutes – no second, simplified count.
      expect((await s.score()).areas.activity.detail.minutes).toBe(75);

      // Edited: 60 instead of 30 minutes of yoga.
      await s.services.activities.update(s.profileId, yoga.id, manual({ durationMin: 60 }));
      result = await s.progress();
      expect(result.activity.goal).toMatchObject({ minutes: 105 });

      // Deleted.
      await s.services.activities.delete(s.profileId, yoga.id);
      result = await s.progress();
      expect(result.activity.goal).toMatchObject({ minutes: 45 });
      expect((await s.score()).areas.activity.detail.minutes).toBe(45);
    });

    it('a target without any activity stays neutral', async () => {
      const s = await setup();
      await s.services.targets.set(s.profileId, 'activeMinutesPerWeek', 150);
      expect((await s.progress()).activity.goal.mode).toBe('noData');
    });
  });

  describe('steps', () => {
    it('C: Health Connect steps against the step goal; days without data are not 0', async () => {
      const s = await setup();
      s.platform.steps = [
        { dayStart: localIso(2026, 10, 1, 0, 0), value: 12_000 },
        { dayStart: localIso(2026, 10, 3, 0, 0), value: 7842 },
      ];
      await s.services.healthSync.connect(s.profileId);
      await s.services.targets.set(s.profileId, 'stepsPerDay', 10_000);
      const today = await s.progress([TODAY]);
      expect(today.steps.attainment).toMatchObject({ actual: 7842, target: 10_000, percent: 78 });

      // Over the week the goal applies from today only: one rated day, two days with data.
      const week = await s.progress();
      expect(week.steps.summary).toMatchObject({
        daysWithData: 2,
        avgSteps: 9921,
        ratedDays: 1,
        reachedDays: 0,
        latestGoal: 10_000,
      });
      expect(week.steps.attainment).toMatchObject({ actual: 7842, target: 10_000 });
    });

    it('C: without Health Connect data there is no 0 of 10.000', async () => {
      const s = await setup();
      await s.services.targets.set(s.profileId, 'stepsPerDay', 10_000);
      const result = await s.progress([TODAY]);
      expect(result.steps.summary).toMatchObject({ daysWithData: 0, avgSteps: null });
      expect(result.steps.attainment).toBeNull();
    });

    it('counts in the score only inside "Aktivitäten" – no area of its own', async () => {
      const s = await setup();
      s.platform.steps = [{ dayStart: localIso(2026, 10, 3, 0, 0), value: 20_000 }];
      await s.services.healthSync.connect(s.profileId);
      await s.services.targets.set(s.profileId, 'stepsPerDay', 5000);
      const score = await s.score([TODAY]);
      expect(score.areas.activity.score).toBe(100);
      expect(score.ratedAreas).toBe(1);
      expect(Object.keys(score.areas)).toEqual(['nutrition', 'training', 'activity', 'recovery']);
      // The card keeps showing the real steps (20.000), not a score value.
      expect((await s.progress([TODAY])).steps.attainment).toMatchObject({ actual: 20_000 });
    });
  });

  describe('nutrition', () => {
    it('D: food updates calories and protein against the day goals of the main goal', async () => {
      const s = await setup();
      await at(new Date(2026, 8, 1, 9), () =>
        s.services.nutrition.goals.save(s.profileId, {
          goalType: 'lose',
          targets: {
            energyKcal: { auto: null, manual: 2200 },
            proteinG: { auto: null, manual: 160 },
          },
        }),
      );
      expect((await s.progress()).nutrition.calories).toBeNull();
      await eat(s, '2026-10-01', 2100, 150);
      await eat(s, '2026-10-02', 2500, 170);
      const result = await s.progress();
      expect(result.nutrition.calories).toMatchObject({
        kind: 'limit',
        avgKcal: 2300,
        avgGoalKcal: 2200,
        ratedDays: 2,
        withinDays: 1,
        aboveDays: 1,
      });
      expect(result.nutrition.protein).toMatchObject({ avgG: 160, avgGoalG: 160, reachedDays: 2 });
      // Five days without entries are missing, not 0 kcal.
      expect(result.nutrition.summary.loggedDays).toBe(2);
    });

    it('keeps a manual protein target unchanged by weight changes', async () => {
      const s = await setup();
      await s.services.profile.updateBodyData(await s.services.profile.ensureLocalProfile(), {
        sex: 'male',
        birthDate: '1990-05-01',
        heightCm: 177,
      });
      await s.services.weight.save(s.profileId, TODAY, 92);
      await s.services.nutrition.goals.saveProfile(s.profileId, {
        params: {
          goalType: 'gain',
          goalLevel: 'moderate',
          activityLevel: 'moderate',
          includeTraining: false,
          targetWeightKg: null,
        },
        overrides: {},
        waterMl: null,
      });
      await s.services.nutrition.goals.setProfileOverride(s.profileId, 'proteinG', 220);
      await s.services.weight.save(s.profileId, TODAY, 80);
      await s.services.nutrition.goals.refreshAutomatic(s.profileId);
      await eat(s, TODAY, 1000, 100);
      const result = await s.progress([TODAY]);
      expect(result.nutrition.protein).toMatchObject({ avgGoalG: 220, today: 'open' });
      expect(result.nutrition.calories).toMatchObject({ kind: 'minimum', today: 'open' });
    });
  });

  describe('weight', () => {
    it('H: own entry wins, Health Connect is the fallback; only the development, no target', async () => {
      const s = await setup();
      s.platform.weights = [
        { id: 'a', measuredAt: localIso(2026, 10, 3, 7), kg: 95, source: 'Waage' },
        { id: 'b', measuredAt: localIso(2026, 9, 28, 7), kg: 93, source: 'Waage' },
      ];
      await s.services.healthSync.connect(s.profileId);
      await s.services.weight.save(s.profileId, TODAY, 91.8);
      const result = await s.progress();
      expect(result.weight.start).toMatchObject({ date: '2026-09-28', kg: 93, source: 'imported' });
      expect(result.weight.end).toMatchObject({ date: TODAY, kg: 91.8, source: 'own' });
      expect(result.weight.changeKg).toBe(-1.2);
      expect(Object.keys(result.weight)).not.toContain('target');
    });
  });
});
