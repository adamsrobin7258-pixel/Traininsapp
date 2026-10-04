import { createServices } from '@/app/services';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { TrainingError } from './errors';
import type { SetValues } from './sets';
import type { WorkoutDetail } from './workout';

// Saturday, 3 October 2026, 10:00 local time.
const TODAY_AT = () => new Date(2026, 9, 3, 10);
let now = TODAY_AT();
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
  now = TODAY_AT();
  const services = createServices(
    { driver: await createTestDatabase(), security: ENCRYPTED_TEST_SECURITY },
    clock,
  );
  const profileId = (await services.profile.ensureLocalProfile()).id;
  await services.training.exercises.ensureCatalog();
  return { services, t: services.training, profileId };
}
type Setup = Awaited<ReturnType<typeof setup>>;

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (error: unknown) => (error instanceof TrainingError ? error.code : String(error)),
  );

const values = (weightKg: number | null, reps: number | null): SetValues => ({
  weightKg,
  reps,
  durationS: null,
  distanceM: null,
  rpe: null,
});

/** A plan with days A, B, C; day A: bench press 3 × 8. */
async function abcPlan({ t, profileId }: Setup, name = 'Push Pull Legs') {
  const plan = await t.plans.createPlan(profileId, name);
  const a = await t.plans.addDay(profileId, plan.id, 'Tag A – Push');
  const b = await t.plans.addDay(profileId, plan.id, 'Tag B – Pull');
  const c = await t.plans.addDay(profileId, plan.id, 'Tag C – Legs');
  const bench = await t.plans.addExercise(profileId, a, 'sys.bench-press');
  await t.plans.setTargets(profileId, bench, 3, 8);
  await t.plans.addExercise(profileId, b, 'sys.dumbbell-row');
  await t.plans.addExercise(profileId, c, 'sys.back-squat');
  return { planId: plan.id, a, b, c, bench };
}

/**
 * Trains a plan day on `day` (October 2026): every working set of the first exercise gets
 * `kg × reps` (one value per set) and is completed; then the workout is finished.
 */
async function train(
  { t, profileId }: Setup,
  dayId: string,
  day: number,
  kg: number,
  reps: readonly number[] = [8, 8, 8],
): Promise<WorkoutDetail> {
  now = new Date(2026, 9, day, 18);
  const workout = await t.workouts.startFromPlan(profileId, dayId);
  const detail = await t.workouts.getDetail(profileId, workout.id);
  for (const exercise of detail.exercises) {
    const working = exercise.sets.filter((set) => set.setType === 'working');
    for (const [index, set] of working.entries()) {
      await t.workouts.updateSet(profileId, set.id, values(kg, reps[index] ?? 8), true);
    }
  }
  now = new Date(2026, 9, day, 19);
  await t.workouts.finish(profileId, workout.id);
  now = TODAY_AT();
  return t.workouts.getDetail(profileId, workout.id);
}

const nextDay = async ({ t, profileId }: Setup, planId: string) =>
  (await t.plans.nextDays(profileId)).get(planId)?.dayName;

describe('next workout from a plan', () => {
  it('no plans: no suggestion', async () => {
    const s = await setup();
    expect(await s.t.plans.nextDays(s.profileId)).toEqual(new Map());
    expect(await s.t.plans.nextWorkout(s.profileId)).toBeNull();
  });

  it('first day, then the next one, and back to the first after the last', async () => {
    const s = await setup();
    const plan = await abcPlan(s);
    expect(await nextDay(s, plan.planId)).toBe('Tag A – Push');
    await train(s, plan.a, 1, 80);
    expect(await nextDay(s, plan.planId)).toBe('Tag B – Pull');
    await train(s, plan.b, 2, 30);
    expect(await nextDay(s, plan.planId)).toBe('Tag C – Legs');
    await train(s, plan.c, 3, 100);
    expect(await nextDay(s, plan.planId)).toBe('Tag A – Push');
  });

  it('any day can be chosen; the suggestion follows the day actually trained', async () => {
    const s = await setup();
    const plan = await abcPlan(s);
    // Suggested is A – the user trains C instead.
    await train(s, plan.c, 1, 100);
    expect(await nextDay(s, plan.planId)).toBe('Tag A – Push');
    await train(s, plan.b, 2, 30);
    expect(await nextDay(s, plan.planId)).toBe('Tag C – Legs');
  });

  it('several plans: each keeps its own sequence, none is made "active"', async () => {
    const s = await setup();
    const first = await abcPlan(s, 'Plan 1');
    const second = await abcPlan(s, 'Plan 2');
    await train(s, first.a, 1, 80);
    expect(await nextDay(s, first.planId)).toBe('Tag B – Pull');
    expect(await nextDay(s, second.planId)).toBe('Tag A – Push');
    await train(s, second.a, 2, 80);
    await train(s, second.b, 3, 30);
    expect(await nextDay(s, first.planId)).toBe('Tag B – Pull');
    expect(await nextDay(s, second.planId)).toBe('Tag C – Legs');
    // The training page suggests the plan trained most recently.
    expect(await s.t.plans.nextWorkout(s.profileId)).toMatchObject({
      planName: 'Plan 2',
      dayName: 'Tag C – Legs',
    });
  });

  it('an active or discarded workout does not move the sequence', async () => {
    const s = await setup();
    const plan = await abcPlan(s);
    const active = await s.t.workouts.startFromPlan(s.profileId, plan.a);
    expect(await nextDay(s, plan.planId)).toBe('Tag A – Push');
    await s.t.workouts.discard(s.profileId, active.id);
    expect(await nextDay(s, plan.planId)).toBe('Tag A – Push');
  });
});

describe('last values', () => {
  it('shows the last real performance with every set and its type, not the plan targets', async () => {
    const s = await setup();
    const plan = await abcPlan(s);
    await s.t.plans.configure(s.profileId, plan.bench, {
      targetSets: 3,
      targetReps: 8,
      warmupSets: 1,
      dropSets: 1,
    });
    expect(await s.t.workouts.lastPerformance(s.profileId, 'sys.bench-press', null)).toBeNull();

    now = new Date(2026, 9, 1, 18);
    const first = await s.t.workouts.startFromPlan(s.profileId, plan.a);
    const sets = (await s.t.workouts.getDetail(s.profileId, first.id)).exercises[0]?.sets ?? [];
    // Warm-up, three working sets and a drop, each with its own values.
    const logged: [number, number][] = [
      [40, 10],
      [80, 8],
      [80, 8],
      [80, 9],
      [60, 6],
    ];
    for (const [index, set] of sets.entries()) {
      const [kg, reps] = logged[index] ?? [0, 0];
      await s.t.workouts.updateSet(s.profileId, set.id, values(kg, reps), true);
    }
    await s.t.workouts.finish(s.profileId, first.id);

    const last = await s.t.workouts.lastPerformance(s.profileId, 'sys.bench-press', null);
    expect(last?.sets.map((set) => [set.setType, set.weightKg, set.reps])).toEqual([
      ['warmup', 40, 10],
      ['working', 80, 8],
      ['working', 80, 8],
      ['working', 80, 9],
      ['drop', 60, 6],
    ]);
    // A new workout is pre-filled from it per set type – no invented values for new exercises.
    now = new Date(2026, 9, 2, 18);
    const next = await s.t.workouts.startFromPlan(s.profileId, plan.a);
    const prefilled = (await s.t.workouts.getDetail(s.profileId, next.id)).exercises[0]?.sets;
    expect(prefilled?.map((set) => [set.setType, set.weightKg, set.reps, set.completed])).toEqual([
      ['warmup', 40, 10, false],
      ['working', 80, 8, false],
      ['working', 80, 8, false],
      ['working', 80, 9, false],
      ['drop', 60, 6, false],
    ]);
    const squatDay = await s.t.workouts.addExercise(s.profileId, next.id, 'sys.plank');
    const plank = (await s.t.workouts.getDetail(s.profileId, next.id)).exercises.find(
      (e) => e.id === squatDay,
    );
    expect(plank?.sets.map((set) => [set.durationS, set.weightKg])).toEqual([[null, null]]);
  });

  it('a corrected past workout is what the next workout sees', async () => {
    const s = await setup();
    const plan = await abcPlan(s);
    const done = await train(s, plan.a, 1, 80);
    const set = done.exercises[0]?.sets[1];
    await s.t.workouts.updateSet(s.profileId, set?.id ?? '', values(85, 6), true);
    const last = await s.t.workouts.lastPerformance(s.profileId, 'sys.bench-press', null);
    expect(last?.sets.map((x) => [x.weightKg, x.reps])).toEqual([
      [80, 8],
      [85, 6],
      [80, 8],
    ]);
  });
});

describe('weight increase suggestions', () => {
  async function suggestion(s: Setup, mode: 'off' | 'cautious' | 'normal' | 'progressive') {
    const plan = (await s.t.plans.listPlans(s.profileId))[0];
    const detail = plan ? await s.t.plans.getPlan(s.profileId, plan.id) : null;
    const dayA = detail?.days[0]?.id ?? '';
    now = new Date(2026, 9, 20, 18);
    const active =
      (await s.t.workouts.getActive(s.profileId)) ??
      (await s.t.workouts.getDetail(
        s.profileId,
        (await s.t.workouts.startFromPlan(s.profileId, dayA)).id,
      ));
    now = TODAY_AT();
    const exercise = active.exercises[0];
    return s.t.workouts.progression(s.profileId, exercise?.id ?? '', mode, 'kg');
  }

  it('appears after the configured number of equal successful sessions', async () => {
    const s = await setup();
    const plan = await abcPlan(s);
    await train(s, plan.a, 1, 80);
    await train(s, plan.a, 3, 80);
    expect(await suggestion(s, 'normal')).toBeNull(); // 2 of 3
    expect(await suggestion(s, 'progressive')).toMatchObject({ weightKg: 86.25, reps: 5 });
    const active = await s.t.workouts.getActive(s.profileId);
    await s.t.workouts.discard(s.profileId, active?.id ?? '');
    await train(s, plan.a, 5, 80);
    expect(await suggestion(s, 'normal')).toMatchObject({ fromKg: 80, weightKg: 83.75, reps: 6 });
    expect(await suggestion(s, 'cautious')).toBeNull(); // 3 of 4
    expect(await suggestion(s, 'off')).toBeNull();
  });

  it('a weaker session prevents it; correcting that session changes the result', async () => {
    const s = await setup();
    const plan = await abcPlan(s);
    await train(s, plan.a, 1, 80);
    await train(s, plan.a, 3, 80);
    const weak = await train(s, plan.a, 5, 80, [8, 5, 4]);
    expect(await suggestion(s, 'normal')).toBeNull();
    // The user corrects a typo in the past workout: it was 8, 8, 8.
    for (const set of weak.exercises[0]?.sets.slice(1) ?? []) {
      await s.t.workouts.updateSet(s.profileId, set.id, values(80, 8), true);
    }
    expect(await suggestion(s, 'normal')).toMatchObject({ weightKg: 83.75, reps: 6 });
  });

  it('is never applied automatically; the user enters what they really lifted', async () => {
    const s = await setup();
    const plan = await abcPlan(s);
    for (const day of [1, 3, 5]) await train(s, plan.a, day, 80);
    expect(await suggestion(s, 'normal')).toMatchObject({ weightKg: 83.75 });
    // The new workout is pre-filled with the last values, not with the suggestion.
    const active = await s.t.workouts.getActive(s.profileId);
    const sets = active?.exercises[0]?.sets ?? [];
    expect(sets.map((set) => [set.weightKg, set.reps])).toEqual([
      [80, 8],
      [80, 8],
      [80, 8],
    ]);
    // The user overrides with their own choice.
    await s.t.workouts.updateSet(s.profileId, sets[0]?.id ?? '', values(82.5, 7), true);
    const stored = await s.t.workouts.getActive(s.profileId);
    expect(stored?.exercises[0]?.sets[0]).toMatchObject({ weightKg: 82.5, reps: 7 });
  });

  it('needs a rep target from the plan: free workouts and exercises without target get none', async () => {
    const s = await setup();
    const plan = await abcPlan(s);
    for (const day of [1, 3, 5]) await train(s, plan.a, day, 80);
    now = new Date(2026, 9, 20, 18);
    const free = await s.t.workouts.startFree(s.profileId);
    const added = await s.t.workouts.addExercise(s.profileId, free.id, 'sys.bench-press');
    expect(await s.t.workouts.progression(s.profileId, added, 'normal', 'kg')).toBeNull();
    // Removing the target from the plan removes the suggestion.
    await s.t.workouts.discard(s.profileId, free.id);
    await s.t.plans.setTargets(s.profileId, plan.bench, 3, null);
    expect(await suggestion(s, 'normal')).toBeNull();
  });
});

describe('replacing an exercise during a workout', () => {
  it('changes only this workout; the plan and the next workout keep the planned exercise', async () => {
    const s = await setup();
    const plan = await abcPlan(s);
    await train(s, plan.a, 1, 80);
    // Some dumbbell bench history to pre-fill from.
    now = new Date(2026, 9, 2, 8);
    const free = await s.t.workouts.startFree(s.profileId);
    const db = await s.t.workouts.addExercise(s.profileId, free.id, 'sys.dumbbell-bench-press');
    const dbSet = (await s.t.workouts.getDetail(s.profileId, free.id)).exercises.find(
      (e) => e.id === db,
    )?.sets[0];
    await s.t.workouts.updateSet(s.profileId, dbSet?.id ?? '', values(30, 10), true);
    await s.t.workouts.finish(s.profileId, free.id);
    const planBefore = await s.t.plans.getPlan(s.profileId, plan.planId);

    now = new Date(2026, 9, 3, 8);
    const workout = await s.t.workouts.startFromPlan(s.profileId, plan.a);
    const exercise = (await s.t.workouts.getDetail(s.profileId, workout.id)).exercises[0];
    await s.t.workouts.replaceExercise(s.profileId, exercise?.id ?? '', 'sys.dumbbell-bench-press');
    const replaced = (await s.t.workouts.getDetail(s.profileId, workout.id)).exercises[0];
    expect(replaced).toMatchObject({
      exerciseId: 'sys.dumbbell-bench-press',
      nameDe: 'Kurzhantel-Bankdrücken',
    });
    // Same structure (3 working sets), values from the dumbbell history.
    expect(replaced?.sets.map((set) => [set.weightKg, set.reps])).toEqual([
      [30, 10],
      [30, 10],
      [30, 10],
    ]);
    for (const set of replaced?.sets ?? []) {
      await s.t.workouts.updateSet(s.profileId, set.id, values(32, 10), true);
    }
    await s.t.workouts.finish(s.profileId, workout.id);

    expect(await s.t.plans.getPlan(s.profileId, plan.planId)).toEqual(planBefore);
    const history = await s.t.workouts.getDetail(s.profileId, workout.id);
    expect(history.exercises.map((e) => e.exerciseId)).toEqual(['sys.dumbbell-bench-press']);

    now = new Date(2026, 9, 5, 8);
    const again = await s.t.workouts.startFromPlan(s.profileId, plan.a);
    const nextExercise = (await s.t.workouts.getDetail(s.profileId, again.id)).exercises[0];
    expect(nextExercise?.exerciseId).toBe('sys.bench-press');
    // Pre-filled from the last bench press, not the dumbbell workout.
    expect(nextExercise?.sets[0]).toMatchObject({ weightKg: 80, reps: 8 });
  });

  it('another exercise type gets new sets of the same structure; same type keeps logged values', async () => {
    const s = await setup();
    const plan = await abcPlan(s);
    now = new Date(2026, 9, 3, 8);
    const workout = await s.t.workouts.startFromPlan(s.profileId, plan.a);
    const exercise = (await s.t.workouts.getDetail(s.profileId, workout.id)).exercises[0];
    await s.t.workouts.replaceExercise(s.profileId, exercise?.id ?? '', 'sys.plank');
    const plank = (await s.t.workouts.getDetail(s.profileId, workout.id)).exercises[0];
    await s.t.workouts.discard(s.profileId, workout.id);
    expect(plank?.exerciseType).toBe('timed');
    expect(plank?.sets.map((set) => [set.setType, set.weightKg, set.reps, set.durationS])).toEqual([
      ['working', null, null, null],
      ['working', null, null, null],
      ['working', null, null, null],
    ]);
    // A completed workout: replacing with the same type only corrects the exercise.
    const done = await train(s, plan.a, 1, 80);
    const benchId = done.exercises[0]?.id ?? '';
    await s.t.workouts.replaceExercise(s.profileId, benchId, 'sys.incline-bench-press');
    const corrected = await s.t.workouts.getDetail(s.profileId, done.id);
    expect(corrected.exercises[0]?.exerciseId).toBe('sys.incline-bench-press');
    expect(
      corrected.exercises[0]?.sets.map((set) => [set.weightKg, set.reps, set.completed]),
    ).toEqual([
      [80, 8, true],
      [80, 8, true],
      [80, 8, true],
    ]);
    expect(await code(s.t.workouts.replaceExercise(s.profileId, benchId, 'sys.unknown'))).toBe(
      'not-found',
    );
  });
});

describe('editing a finished workout', () => {
  it('everything can be corrected, and progress, score, history and suggestions follow', async () => {
    const s = await setup();
    const { services, profileId, t } = s;
    // Training target chosen on 1 September – it applies from that day.
    now = new Date(2026, 8, 1, 9);
    await services.targets.set(profileId, 'trainingsPerWeek', 3);
    now = TODAY_AT();
    const plan = await abcPlan(s);
    const done = await train(s, plan.a, 1, 80);
    const id = done.id;
    const volume = async () =>
      (await t.workouts.dailyStatsBetween(profileId, '2026-10-01', '2026-10-01'))[0]?.volumeKg;
    expect(await volume()).toBe(1920);

    // Values, reps and a set type.
    const [s1, s2, s3] = done.exercises[0]?.sets ?? [];
    await t.workouts.updateSet(profileId, s1?.id ?? '', values(85, 6), true);
    // Delete a set, turn another into a drop of the first, add a set.
    await t.workouts.deleteSet(profileId, s2?.id ?? '');
    await t.workouts.changeSetType(profileId, s3?.id ?? '', 'drop');
    const added = await t.workouts.addSet(profileId, done.exercises[0]?.id ?? '');
    await t.workouts.updateSet(profileId, added, values(70, 10), true);
    // Exercises: add, move, replace, remove.
    const squat = await t.workouts.addExercise(profileId, id, 'sys.back-squat');
    const squatSet = (await t.workouts.getDetail(profileId, id)).exercises.find(
      (e) => e.id === squat,
    )?.sets[0];
    await t.workouts.updateSet(profileId, squatSet?.id ?? '', values(100, 5), true);
    await t.workouts.moveExercise(profileId, squat, -1);
    const row = await t.workouts.addExercise(profileId, id, 'sys.dumbbell-row');
    await t.workouts.replaceExercise(profileId, row, 'sys.dumbbell-shrug');
    await t.workouts.removeExercise(profileId, row);
    // Notes and duration.
    await t.workouts.updateDetails(profileId, id, 'Brust schwer', 'Schulter gemerkt');
    await t.workouts.updateDuration(profileId, id, 75);

    const edited = await t.workouts.getDetail(profileId, id);
    expect(edited).toMatchObject({
      title: 'Brust schwer',
      notes: 'Schulter gemerkt',
      durationS: 4500,
    });
    expect(edited.endedAt).toBe(new Date(Date.parse(edited.startedAt) + 4500_000).toISOString());
    expect(edited.exercises.map((e) => e.exerciseId)).toEqual([
      'sys.back-squat',
      'sys.bench-press',
    ]);
    expect(edited.exercises[1]?.sets.map((set) => [set.setType, set.weightKg, set.reps])).toEqual([
      ['working', 85, 6],
      ['drop', 80, 8],
      ['working', 70, 10],
    ]);
    // Volume: 85×6 + 80×8 (drop) + 70×10 + 100×5 = 510 + 640 + 700 + 500.
    expect(await volume()).toBe(2350);
    // History list, last values and the overlap span follow the correction.
    const [summary] = await t.workouts.getHistory(profileId, { limit: 1 });
    // Working sets only (the drop belongs to its set): 85 × 6, 70 × 10 and the squat.
    expect(summary).toMatchObject({ id, exerciseCount: 2, completedSetCount: 3, durationS: 4500 });
    const last = await t.workouts.lastPerformance(profileId, 'sys.bench-press', null);
    expect(last?.sets.map((set) => set.weightKg)).toEqual([85, 80, 70]);
    const [span] = await t.workouts.completedSpansBetween(profileId, '2026-10-01', '2026-10-01');
    expect(span).toMatchObject({ endedAt: edited.endedAt });

    // Score: the workout counts once; after deleting it, it is gone everywhere.
    const before = await services.score.calculate(profileId, WEEK, {
      today: TODAY,
      todayProgress: 0.5,
    });
    expect(before.areas.training.detail.done).toBe(1);
    await t.workouts.delete(profileId, id);
    const after = await services.score.calculate(profileId, WEEK, {
      today: TODAY,
      todayProgress: 0.5,
    });
    expect(after.areas.training.detail.done).toBe(0);
    expect(await volume()).toBeUndefined();
    expect(await t.workouts.lastPerformance(profileId, 'sys.bench-press', null)).toBeNull();
  });

  it('rejects invalid durations and set type changes', async () => {
    const s = await setup();
    const plan = await abcPlan(s);
    const done = await train(s, plan.a, 1, 80);
    expect(await code(s.t.workouts.updateDuration(s.profileId, done.id, 0))).toBe('invalid-value');
    expect(await code(s.t.workouts.updateDuration(s.profileId, done.id, 1.5))).toBe(
      'invalid-value',
    );
    const first = done.exercises[0]?.sets[0]?.id ?? '';
    expect(await code(s.t.workouts.changeSetType(s.profileId, first, 'drop'))).toBe(
      'invalid-value',
    );
    now = new Date(2026, 9, 3, 8);
    const active = await s.t.workouts.startFree(s.profileId);
    expect(await code(s.t.workouts.updateDuration(s.profileId, active.id, 30))).toBe(
      'workout-not-active',
    );
  });
});

describe('historical integrity', () => {
  it('changing or deleting the plan and the exercise never changes a finished workout', async () => {
    const s = await setup();
    const { t, profileId } = s;
    const own = await t.exercises.create(profileId, {
      name: 'Maschinenpresse',
      exerciseType: 'weighted',
      equipment: 'machine',
      movementPattern: 'horizontalPush',
      primaryMuscles: ['chest'],
    });
    const plan = await abcPlan(s);
    await t.plans.addExercise(profileId, plan.a, own.id);
    const done = await train(s, plan.a, 1, 80);
    const snapshot = await t.workouts.getDetail(profileId, done.id);

    await t.plans.renamePlan(profileId, plan.planId, 'Neuer Name');
    await t.plans.renameDay(profileId, plan.a, 'Brust');
    await t.plans.setTargets(profileId, plan.bench, 5, 5);
    await t.plans.removeExercise(profileId, plan.bench);
    await t.exercises.update(profileId, own.id, {
      name: 'Brustpresse',
      exerciseType: 'weighted',
      equipment: 'machine',
      movementPattern: 'horizontalPush',
      primaryMuscles: ['chest'],
    });
    await t.exercises.setActive(profileId, own.id, false);
    expect(await t.workouts.getDetail(profileId, done.id)).toEqual(snapshot);
    await t.plans.deletePlan(profileId, plan.planId);
    const afterDelete = await t.workouts.getDetail(profileId, done.id);
    // Only the link to the deleted plan is gone; names, exercises and sets stay.
    expect(afterDelete).toEqual({ ...snapshot, planId: null, planDayId: null });
    expect(afterDelete.planName).toBe('Push Pull Legs');
    expect(afterDelete.exercises.map((e) => e.nameDe)).toEqual(
      snapshot.exercises.map((e) => e.nameDe),
    );
  });

  it('a deliberate edit changes exactly that workout and what is derived from it', async () => {
    const s = await setup();
    const plan = await abcPlan(s);
    const first = await train(s, plan.a, 1, 80);
    const second = await train(s, plan.a, 2, 80);
    const untouched = await s.t.workouts.getDetail(s.profileId, second.id);
    const set = first.exercises[0]?.sets[0];
    await s.t.workouts.updateSet(s.profileId, set?.id ?? '', values(90, 8), true);
    expect(await s.t.workouts.getDetail(s.profileId, second.id)).toEqual(untouched);
    const stats = await s.t.workouts.dailyStatsBetween(s.profileId, '2026-10-01', '2026-10-02');
    expect(stats.map((day) => day.volumeKg)).toEqual([2000, 1920]);
  });
});

describe('records in the summary', () => {
  it('only a heavier working set than in every earlier workout; never the first time', async () => {
    const s = await setup();
    const plan = await abcPlan(s);
    const first = await train(s, plan.a, 1, 80);
    expect(await s.t.workouts.records(s.profileId, first.id)).toEqual([]);
    const same = await train(s, plan.a, 2, 80);
    expect(await s.t.workouts.records(s.profileId, same.id)).toEqual([]);
    const heavier = await train(s, plan.a, 3, 82.5, [6, 6, 6]);
    expect(await s.t.workouts.records(s.profileId, heavier.id)).toEqual([
      { workoutExerciseId: heavier.exercises[0]?.id, weightKg: 82.5, previousKg: 80 },
    ]);
    // A heavier warm-up or drop is no record.
    const warm = await train(s, plan.a, 4, 80);
    const extra = await s.t.workouts.addSet(s.profileId, warm.exercises[0]?.id ?? '', 'warmup');
    await s.t.workouts.updateSet(s.profileId, extra, values(100, 2), true);
    expect(await s.t.workouts.records(s.profileId, warm.id)).toEqual([]);
  });
});
