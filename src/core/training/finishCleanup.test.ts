import { createServices } from '@/app/services';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { TrainingError } from './errors';
import type { SetValues } from './sets';

/**
 * Finishing a workout keeps exactly what was trained: every set that was not completed – empty
 * or only pre-filled from the last workout, the plan or a suggestion – is removed.
 */

// Saturday, 3 October 2026.
let now = new Date(2026, 9, 3, 10);
const clock = () => now;

async function setup() {
  now = new Date(2026, 9, 3, 10);
  const services = createServices(
    { driver: await createTestDatabase(), security: ENCRYPTED_TEST_SECURITY },
    clock,
  );
  const profileId = (await services.profile.ensureLocalProfile()).id;
  await services.training.exercises.ensureCatalog();
  return { t: services.training, profileId };
}
type Setup = Awaited<ReturnType<typeof setup>>;

const values = (weightKg: number, reps: number): SetValues => ({
  weightKg,
  reps,
  durationS: null,
  distanceM: null,
  rpe: null,
});

/** Plan day "Push": bench press 3 × 8 with one drop, rows 2 × 10. */
async function pushDay({ t, profileId }: Setup) {
  const plan = await t.plans.createPlan(profileId, 'Kraft');
  const day = await t.plans.addDay(profileId, plan.id, 'Push');
  const bench = await t.plans.addExercise(profileId, day, 'sys.bench-press');
  await t.plans.configure(profileId, bench, {
    targetSets: 3,
    targetReps: 8,
    warmupSets: null,
    dropSets: 1,
  });
  const row = await t.plans.addExercise(profileId, day, 'sys.dumbbell-row');
  await t.plans.setTargets(profileId, row, 2, 10);
  return day;
}

/** Trains the day once completely (80 kg × 8, drop 60 × 8, rows 30 × 10) on 1 October. */
async function trainedBefore(s: Setup, day: string) {
  now = new Date(2026, 9, 1, 18);
  const workout = await s.t.workouts.startFromPlan(s.profileId, day);
  const detail = await s.t.workouts.getDetail(s.profileId, workout.id);
  for (const exercise of detail.exercises) {
    for (const set of exercise.sets) {
      const load =
        exercise.exerciseId === 'sys.dumbbell-row' ? 30 : set.setType === 'drop' ? 60 : 80;
      const reps = exercise.exerciseId === 'sys.dumbbell-row' ? 10 : 8;
      await s.t.workouts.updateSet(s.profileId, set.id, values(load, reps), true);
    }
  }
  now = new Date(2026, 9, 1, 19);
  await s.t.workouts.finish(s.profileId, workout.id);
  now = new Date(2026, 9, 3, 10);
}

describe('finishing removes every set that was not completed', () => {
  it('pre-filled and empty open sets go, completed sets stay with their values', async () => {
    const s = await setup();
    const day = await pushDay(s);
    await trainedBefore(s, day);
    const workout = await s.t.workouts.startFromPlan(s.profileId, day);
    const started = await s.t.workouts.getDetail(s.profileId, workout.id);
    const [bench, row] = started.exercises;
    // Everything is pre-filled from the last workout – nothing is completed yet.
    expect(bench?.sets.map((set) => [set.setType, set.weightKg, set.reps, set.completed])).toEqual([
      ['working', 80, 8, false],
      ['working', 80, 8, false],
      ['working', 80, 8, false],
      ['drop', 60, 8, false],
    ]);
    // Two bench sets are really done (one changed), a third set is added empty.
    const [s1, s2] = bench?.sets ?? [];
    await s.t.workouts.updateSet(s.profileId, s1?.id ?? '', values(82.5, 8), true);
    await s.t.workouts.updateSet(s.profileId, s2?.id ?? '', values(82.5, 7), true);
    await s.t.workouts.addSet(s.profileId, row?.id ?? '', 'warmup');

    await s.t.workouts.finish(s.profileId, workout.id);

    const finished = await s.t.workouts.getDetail(s.profileId, workout.id);
    expect(finished.status).toBe('completed');
    const [benchAfter, rowAfter] = finished.exercises;
    expect(
      benchAfter?.sets.map((set) => [set.setType, set.weightKg, set.reps, set.completed]),
    ).toEqual([
      ['working', 82.5, 8, true],
      ['working', 82.5, 7, true],
    ]);
    // Rows were never trained: their pre-filled sets and the empty warm-up are gone.
    expect(rowAfter?.sets).toEqual([]);
    expect(finished.exercises.flatMap((e) => e.sets).every((set) => set.completed)).toBe(true);

    // Volume, history, last values, records and the next pre-fill see only completed sets.
    const [stats] = await s.t.workouts.dailyStatsBetween(s.profileId, '2026-10-03', '2026-10-03');
    expect(stats?.volumeKg).toBe(82.5 * 8 + 82.5 * 7);
    const [summary] = await s.t.workouts.getHistory(s.profileId, { limit: 1 });
    expect(summary).toMatchObject({ id: workout.id, completedSetCount: 2 });
    const last = await s.t.workouts.lastPerformance(s.profileId, 'sys.bench-press', null);
    expect(last?.sets.map((set) => [set.weightKg, set.reps])).toEqual([
      [82.5, 8],
      [82.5, 7],
    ]);
    const lastRow = await s.t.workouts.lastPerformance(s.profileId, 'sys.dumbbell-row', null);
    expect(lastRow?.sets.map((set) => [set.weightKg, set.reps])).toEqual([
      [30, 10],
      [30, 10],
    ]);
    expect(await s.t.workouts.records(s.profileId, workout.id)).toEqual([
      expect.objectContaining({ weightKg: 82.5, previousKg: 80 }),
    ]);
  });

  it('a workout with nothing completed keeps no sets', async () => {
    const s = await setup();
    const workout = await s.t.workouts.startFree(s.profileId);
    const exercise = await s.t.workouts.addExercise(s.profileId, workout.id, 'sys.bench-press');
    const [set] = (await s.t.workouts.getDetail(s.profileId, workout.id)).exercises[0]?.sets ?? [];
    // Values entered but never completed: not training.
    await s.t.workouts.updateSet(s.profileId, set?.id ?? '', values(100, 5), false);
    await s.t.workouts.addSet(s.profileId, exercise);
    await s.t.workouts.finish(s.profileId, workout.id);
    const finished = await s.t.workouts.getDetail(s.profileId, workout.id);
    expect(finished.exercises[0]?.sets).toEqual([]);
    expect(await s.t.workouts.dailyStatsBetween(s.profileId, '2026-10-03', '2026-10-03')).toEqual([
      expect.objectContaining({ volumeKg: 0 }),
    ]);
  });

  it('a completed drop keeps the open working set it continues (no completed set is lost)', async () => {
    const s = await setup();
    const workout = await s.t.workouts.startFree(s.profileId);
    await s.t.workouts.addExercise(s.profileId, workout.id, 'sys.bench-press');
    const [working] =
      (await s.t.workouts.getDetail(s.profileId, workout.id)).exercises[0]?.sets ?? [];
    const drop = await s.t.workouts.addDrop(s.profileId, working?.id ?? '');
    await s.t.workouts.updateSet(s.profileId, working?.id ?? '', values(100, 5), false);
    await s.t.workouts.updateSet(s.profileId, drop, values(70, 6), true);
    await s.t.workouts.finish(s.profileId, workout.id);
    const sets = (await s.t.workouts.getDetail(s.profileId, workout.id)).exercises[0]?.sets ?? [];
    expect(sets.map((set) => [set.setType, set.weightKg, set.completed])).toEqual([
      ['working', 100, false],
      ['drop', 70, true],
    ]);
    // Only the completed drop counts.
    const [stats] = await s.t.workouts.dailyStatsBetween(s.profileId, '2026-10-03', '2026-10-03');
    expect(stats?.volumeKg).toBe(70 * 6);
  });

  it('finishing twice – one after another or at the same time – finishes once', async () => {
    const s = await setup();
    const workout = await s.t.workouts.startFree(s.profileId);
    await s.t.workouts.addExercise(s.profileId, workout.id, 'sys.bench-press');
    const [set] = (await s.t.workouts.getDetail(s.profileId, workout.id)).exercises[0]?.sets ?? [];
    await s.t.workouts.updateSet(s.profileId, set?.id ?? '', values(100, 5), true);

    now = new Date(2026, 9, 3, 11);
    const results = await Promise.allSettled([
      s.t.workouts.finish(s.profileId, workout.id),
      s.t.workouts.finish(s.profileId, workout.id),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    const rejected = results.find((result) => result.status === 'rejected');
    expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(TrainingError);
    expect(((rejected as PromiseRejectedResult).reason as TrainingError).code).toBe(
      'workout-not-active',
    );

    now = new Date(2026, 9, 3, 12);
    await expect(s.t.workouts.finish(s.profileId, workout.id)).rejects.toMatchObject({
      code: 'workout-not-active',
    });
    const finished = await s.t.workouts.getDetail(s.profileId, workout.id);
    // The first finish counts: one hour, one completed set.
    expect(finished).toMatchObject({ status: 'completed', durationS: 3600 });
    expect(finished.exercises[0]?.sets).toHaveLength(1);
    expect(await s.t.workouts.countHistory(s.profileId)).toBe(1);
    expect(await s.t.workouts.getActive(s.profileId)).toBeNull();
  });

  it('discarding stays different: the whole workout is deleted', async () => {
    const s = await setup();
    const workout = await s.t.workouts.startFree(s.profileId);
    await s.t.workouts.addExercise(s.profileId, workout.id, 'sys.bench-press');
    await s.t.workouts.discard(s.profileId, workout.id);
    await expect(s.t.workouts.getDetail(s.profileId, workout.id)).rejects.toMatchObject({
      code: 'not-found',
    });
    expect(await s.t.workouts.countHistory(s.profileId)).toBe(0);
  });
});
