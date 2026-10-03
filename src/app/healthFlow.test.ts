import type { ManualActivityInput } from '@/core/activity';
import { summarizeStepGoal } from '@/core/health';
import type { HealthWorkout } from '@/core/platform/health';
import { targetOn } from '@/core/targets';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import { createServices } from './services';

/**
 * Phase 16 – Health Connect → import → local store → core services → Gesundheit, Fortschritt and
 * score read the same data and rules.
 */
const NOW = new Date(2026, 9, 3, 10); // Saturday
let now = NOW;
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
  const db = await createTestDatabase();
  const services = createServices(
    { driver: db, security: ENCRYPTED_TEST_SECURITY },
    () => now,
    undefined,
    undefined,
    platform,
  );
  const profileId = (await services.profile.ensureLocalProfile()).id;
  return { db, platform, services, profileId };
}

async function at<T>(when: Date, action: () => Promise<T>): Promise<T> {
  now = when;
  try {
    return await action();
  } finally {
    now = NOW;
  }
}

const day = (month: number, d: number, value: number) => ({
  dayStart: localIso(2026, month, d, 0, 0),
  value,
});

function hc(id: string, d: number, hour: number, minutes: number, kcal: number): HealthWorkout {
  const start = localIso(2026, 10, d, hour, 0);
  return {
    id,
    type: 'walking',
    start,
    end: new Date(Date.parse(start) + minutes * 60_000).toISOString(),
    activeKcal: kcal,
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

describe('Health Connect → core → Gesundheit / Fortschritt / Score', () => {
  it('steps: one evaluation – the same share of the goal everywhere, today proportional', async () => {
    const s = await setup();
    // Monday 28 Sep: goal 10.000; from Thursday 1 Oct: 12.000.
    await at(new Date(2026, 8, 28, 9), () =>
      s.services.targets.set(s.profileId, 'stepsPerDay', 10_000),
    );
    await at(new Date(2026, 9, 1, 9), () =>
      s.services.targets.set(s.profileId, 'stepsPerDay', 12_000),
    );
    s.platform.steps = [
      day(9, 28, 9_000), // 90 % of 10.000
      day(9, 30, 12_000), // 100 % of 10.000 (capped)
      day(10, 2, 6_000), // 50 % of 12.000 – not 60 % of the old goal
      day(10, 3, 3_000), // today: 25 % of 12.000, proportional
    ];
    await s.services.healthSync.connect(s.profileId);

    // Gesundheit (the overview reads the store and the targets through the same function).
    const versions = (await s.services.targets.history(s.profileId)).stepsPerDay;
    const stored = await s.services.healthSync.activityBetween(s.profileId, WEEK[0] ?? '', TODAY);
    const health = summarizeStepGoal(
      stored.map((d) => ({ date: d.date, steps: d.steps })),
      WEEK,
      (date) => targetOn(versions, date),
    );
    expect(health.today).toEqual({ steps: 3_000, goal: 12_000, ratio: 0.25 });
    // 27 Sep had no goal yet; 29 Sep and 1 Oct have no data – neutral, never 0.
    expect(health).toMatchObject({ ratedDays: 4, reachedDays: 1, daysWithData: 4 });
    expect(health.avgRatio).toBeCloseTo((0.9 + 1 + 0.5 + 0.25) / 4, 10);

    // Fortschritt and score: the same 66 %.
    const progress = await s.services.progress.calculate(s.profileId, WEEK, { today: TODAY });
    const score = await s.services.score.calculate(s.profileId, WEEK, { today: TODAY });
    expect(progress.steps.attainment?.percent).toBe(66);
    expect(score.areas.activity.detail.steps.score).toBe(66);
    expect(score.areas.activity.score).toBe(66); // steps only – still inside "Aktivitäten"
    expect(Object.keys(score.areas)).toEqual(['nutrition', 'training', 'activity', 'recovery']);
  });

  it('active minutes: card and score divide by the same whole-minute goal (20 of 26 → 77)', async () => {
    const s = await setup();
    // 180 per week → today's share 25,7 → shown and used as 26 minutes.
    await s.services.targets.set(s.profileId, 'activeMinutesPerWeek', 180);
    for (const [minutes, expected] of [
      [20, 77],
      [26, 100],
      [30, 100],
    ] as const) {
      const list = await s.services.activities.listBetween(s.profileId, TODAY, TODAY);
      for (const activity of list) await s.services.activities.delete(s.profileId, activity.id);
      await s.services.activities.create(
        s.profileId,
        manual({ localDate: TODAY, durationMin: minutes }),
      );
      const progress = await s.services.progress.calculate(s.profileId, [TODAY], { today: TODAY });
      const score = await s.services.score.calculate(s.profileId, [TODAY], { today: TODAY });
      expect(progress.activity.goal).toMatchObject({ expectedMinutes: 26, minutes });
      expect(score.areas.activity.detail.expectedMinutes).toBe(26);
      expect(score.areas.activity.detail.minutesScore).toBe(expected);
      const card =
        progress.activity.goal.mode === 'full' ? progress.activity.goal.attainment : null;
      expect(Math.min(100, card?.percent ?? 0)).toBe(expected);
    }
  });

  it('activities: card, calorie budget and score use one eligibility (Kalethra workout and duplicate once)', async () => {
    const s = await setup();
    await at(new Date(2026, 8, 1, 9), async () => {
      await s.services.targets.set(s.profileId, 'activeMinutesPerWeek', 150);
      await s.services.targets.set(s.profileId, 'activityCalories', 1);
      await s.services.nutrition.goals.save(s.profileId, {
        goalType: 'maintain',
        targets: {
          energyKcal: { auto: null, manual: 2300 },
          proteinG: { auto: null, manual: 160 },
        },
      });
    });
    s.platform.workouts = [
      hc('walk', 2, 7, 45, 200), // counts
      hc('gym', 2, 18, 60, 400), // = the Kalethra workout below → training, not activity
    ];
    await s.services.healthSync.connect(s.profileId);
    // Kalethra workout 18:00–19:00 on 2 Oct.
    const workout = await at(new Date(2026, 9, 2, 18), () =>
      s.services.training.workouts.startFree(s.profileId),
    );
    await at(new Date(2026, 9, 2, 19), () =>
      s.services.training.workouts.finish(s.profileId, workout.id),
    );
    // The walk logged by hand as well (duplicate) and a separate yoga session.
    await s.services.activities.create(
      s.profileId,
      manual({ sportId: 'walk', startTime: '07:05', durationMin: 40, kcalOverride: 180 }),
    );
    await s.services.activities.create(s.profileId, manual({ durationMin: 30, kcalOverride: 90 }));

    const progress = await s.services.progress.calculate(s.profileId, WEEK, { today: TODAY });
    const score = await s.services.score.calculate(s.profileId, WEEK, { today: TODAY });
    const budget = await s.services.nutrition.goals.dayGoalsBetween(s.profileId, ['2026-10-02']);
    // Walk 45 + yoga 30 = 75 minutes, 200 + 90 = 290 kcal – everywhere the same.
    expect(progress.activity.summary).toMatchObject({
      count: 2,
      durationS: 75 * 60,
      activeKcal: 290,
    });
    expect(score.areas.activity.detail.minutes).toBe(75);
    expect(progress.activity.goal).toMatchObject({ minutes: 75 });
    // The calorie budget gets exactly these 290 kcal – not the gym session, not the duplicate.
    expect(budget[0]?.energyKcal).toBe(2300 + 290);
    expect(budget[0]?.proteinG).toBe(160); // protein never changes with activity calories
    // Health Connect and manual activities never count as Kalethra training.
    expect(progress.training.summary.workouts).toBe(1);
  });

  it('weight: own entry wins on the same day; Health Connect fills other days; nutrition reads own only', async () => {
    const s = await setup();
    s.platform.weights = [
      { id: 'a', measuredAt: localIso(2026, 10, 3, 7), kg: 95, source: 'Waage' },
      { id: 'b', measuredAt: localIso(2026, 9, 29, 7), kg: 93, source: 'Waage' },
    ];
    await s.services.healthSync.connect(s.profileId);
    await s.services.weight.save(s.profileId, TODAY, 92);
    const progress = await s.services.progress.calculate(s.profileId, WEEK, { today: TODAY });
    expect(progress.weight.latest).toMatchObject({ kg: 92, source: 'own' });
    expect(progress.weight.start).toMatchObject({ kg: 93, source: 'imported' });
    // Rule 1: nutrition only sees the own entry.
    expect(await s.services.bodyWeight.latestKgOnOrBefore(s.profileId, TODAY)).toBe(92);
    expect(await s.services.bodyWeight.pointsBetween(s.profileId, WEEK[0] ?? '', TODAY)).toEqual([
      { date: TODAY, kg: 92 },
    ]);
  });

  it('disconnect with delete removes only imported data; reconnect imports again without duplicates', async () => {
    const s = await setup();
    s.platform.weights = [
      { id: 'w', measuredAt: localIso(2026, 10, 2, 7), kg: 93, source: 'Waage' },
    ];
    s.platform.steps = [day(10, 2, 8_000)];
    s.platform.workouts = [hc('walk', 2, 7, 45, 200)];
    await s.services.healthSync.connect(s.profileId);
    await s.services.weight.save(s.profileId, TODAY, 92);
    await s.services.activities.create(s.profileId, manual());
    const own = await at(new Date(2026, 9, 1, 18), () =>
      s.services.training.workouts.startFree(s.profileId),
    );
    await at(new Date(2026, 9, 1, 19), () =>
      s.services.training.workouts.finish(s.profileId, own.id),
    );
    await s.services.recovery.save(s.profileId, TODAY, { state: 'good', restDay: false });

    const count = async (table: string) =>
      (await s.db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))[0]?.n;
    const imported = async () => ({
      weights: await count('imported_weights'),
      activity: await count('daily_activity'),
      workouts: await count('external_workouts'),
    });
    expect(await imported()).toEqual({ weights: 1, activity: 1, workouts: 1 });

    await s.services.healthSync.disconnect(s.profileId, { deleteImported: true });
    expect(await imported()).toEqual({ weights: 0, activity: 0, workouts: 0 });
    // Own data stays: weight, manual activity, Kalethra workout, recovery.
    expect(await count('weight_entries')).toBe(1);
    expect(await count('manual_activities')).toBe(1);
    expect(await count('workouts')).toBe(1);
    expect(await count('recovery_entries')).toBe(1);

    // Reconnect, sync again manually: imported once, no duplicates.
    await s.services.healthSync.connect(s.profileId);
    await s.services.healthSync.sync(s.profileId, { manual: true });
    expect(await imported()).toEqual({ weights: 1, activity: 1, workouts: 1 });
    expect(await count('weight_entries')).toBe(1);
  });

  it('recovery: good / moderate / poor and a rest day through the one score rule; none is neutral', async () => {
    const s = await setup();
    const score = async () =>
      (await s.services.score.calculate(s.profileId, WEEK, { today: TODAY })).areas.recovery;
    expect((await score()).score).toBeNull();
    await at(new Date(2026, 9, 1, 9), () =>
      s.services.recovery.save(s.profileId, '2026-10-01', { state: 'good', restDay: false }),
    );
    await at(new Date(2026, 9, 2, 9), () =>
      s.services.recovery.save(s.profileId, '2026-10-02', { state: 'moderate', restDay: true }),
    );
    await s.services.recovery.save(s.profileId, TODAY, { state: 'poor', restDay: false });
    // (100 + 60 + 20) / 3 = 60; the rest day is no minus by itself.
    expect(await score()).toMatchObject({
      score: 60,
      detail: { entries: 3, good: 1, moderate: 1, poor: 1, restDays: 1 },
    });
    // One entry per day: saving again replaces it.
    await s.services.recovery.save(s.profileId, TODAY, { state: 'good', restDay: false });
    expect((await score()).detail).toMatchObject({ entries: 3, good: 2, poor: 0 });
  });
});
