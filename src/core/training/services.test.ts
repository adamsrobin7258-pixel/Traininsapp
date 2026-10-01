import { migrate, migrations } from '@/core/database';
import { openSqlJsDriver } from '@/core/database/drivers/sqlJs';
import { ProfileRepository, ProfileService } from '@/core/user';
import { createTestDatabase, fixedClock } from '@/test/database';
import { TrainingError } from './errors';
import { EXERCISE_CATALOG } from './exerciseCatalog';
import { ExerciseService } from './exerciseService';
import { PlanService } from './planService';
import { EMPTY_SET_VALUES } from './sets';
import { TrainingStore } from './trainingStore';
import { WorkoutService } from './workoutService';

let now = new Date('2026-10-03T08:00:00.000Z');
const clock = () => now;
const advance = (minutes: number) => {
  now = new Date(now.getTime() + minutes * 60_000);
};

async function setup() {
  now = new Date('2026-10-03T08:00:00.000Z');
  const db = await createTestDatabase();
  const profile = await new ProfileService(
    new ProfileRepository(db),
    fixedClock(),
  ).ensureLocalProfile();
  const store = new TrainingStore(db);
  const exercises = new ExerciseService(store, clock);
  const plans = new PlanService(store, clock);
  const workouts = new WorkoutService(store, clock);
  await exercises.ensureCatalog();
  return { db, store, exercises, plans, workouts, profileId: profile.id };
}

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (error: unknown) => (error instanceof TrainingError ? error.code : String(error)),
  );

describe('exercise catalog and custom exercises', () => {
  it('seeds the catalog once and keeps it idempotent', async () => {
    const { db, exercises, profileId } = await setup();
    await exercises.ensureCatalog();
    const list = await exercises.list(profileId);
    expect(list).toHaveLength(EXERCISE_CATALOG.length);
    expect(list.find((e) => e.id === 'sys.bench-press')).toMatchObject({
      nameDe: 'Bankdrücken',
      nameEn: 'Bench Press',
      primaryMuscles: ['chest'],
      secondaryMuscles: ['triceps', 'shoulders'],
    });
    const rows = await db.query<{ n: number }>(
      "SELECT COUNT(*) AS n FROM exercises WHERE source = 'system'",
    );
    expect(rows[0]?.n).toBe(EXERCISE_CATALOG.length);
  });

  it('creates, edits and deactivates user exercises without translating names', async () => {
    const { exercises, profileId } = await setup();
    const own = await exercises.create(profileId, {
      name: ' Landmine  Press ',
      exerciseType: 'weighted',
      equipment: 'barbell',
      movementPattern: 'verticalPush',
      primaryMuscles: ['shoulders'],
    });
    expect(own).toMatchObject({
      source: 'user',
      nameDe: 'Landmine Press',
      nameEn: 'Landmine Press',
    });

    await exercises.update(profileId, own.id, {
      name: 'Landmine Press (einarmig)',
      exerciseType: 'weighted',
      equipment: 'barbell',
      movementPattern: 'verticalPush',
      primaryMuscles: ['shoulders', 'triceps'],
    });
    await exercises.setActive(profileId, own.id, false);
    expect((await exercises.list(profileId)).some((e) => e.id === own.id)).toBe(false);
    const all = await exercises.list(profileId, { includeInactive: true });
    expect(all.find((e) => e.id === own.id)).toMatchObject({
      active: false,
      nameDe: 'Landmine Press (einarmig)',
      primaryMuscles: ['shoulders', 'triceps'],
    });
  });

  it('rejects invalid names and foreign or system exercises', async () => {
    const { exercises, profileId } = await setup();
    const input = {
      name: '  ',
      exerciseType: 'weighted' as const,
      equipment: 'barbell' as const,
      movementPattern: 'other' as const,
      primaryMuscles: [],
    };
    expect(await code(exercises.create(profileId, input))).toBe('invalid-name');
    expect(
      await code(exercises.update(profileId, 'sys.bench-press', { ...input, name: 'x' })),
    ).toBe('not-found');
    expect(await code(exercises.setActive(profileId, 'sys.bench-press', false))).toBe('not-found');
  });
});

describe('free strength workout', () => {
  it('runs start → exercise → sets → finish and lands in history', async () => {
    const { workouts, profileId } = await setup();
    const workout = await workouts.startFree(profileId);
    expect(await code(workouts.startFree(profileId))).toBe('active-workout-exists');

    const benchId = await workouts.addExercise(profileId, workout.id, 'sys.bench-press');
    let active = await workouts.getActive(profileId);
    const firstSet = active!.exercises[0]!.sets[0]!;
    expect(firstSet).toMatchObject({ weightKg: null, reps: null, completed: false });

    await workouts.updateSet(
      profileId,
      firstSet.id,
      { ...EMPTY_SET_VALUES, weightKg: 80, reps: 8, rpe: 8 },
      true,
    );
    const second = await workouts.addSet(profileId, benchId);
    active = await workouts.getActive(profileId);
    // New sets copy the previous values for fast entry (RPE is not copied).
    expect(active!.exercises[0]!.sets[1]).toMatchObject({
      id: second,
      weightKg: 80,
      reps: 8,
      rpe: null,
      completed: false,
    });
    await workouts.updateSet(
      profileId,
      second,
      { ...EMPTY_SET_VALUES, weightKg: 80, reps: 7 },
      true,
    );
    await workouts.addSet(profileId, benchId); // untouched placeholder
    await workouts.updateSet(
      profileId,
      (await workouts.getActive(profileId))!.exercises[0]!.sets[2]!.id,
      EMPTY_SET_VALUES,
      false,
    );

    advance(52);
    const finished = await workouts.finish(profileId, workout.id);
    expect(finished).toMatchObject({ status: 'completed', durationS: 52 * 60 });
    expect(await workouts.getActive(profileId)).toBeNull();

    const detail = await workouts.getDetail(profileId, workout.id);
    expect(detail.exercises[0]!.sets.map((s) => [s.weightKg, s.reps, s.rpe])).toEqual([
      [80, 8, 8],
      [80, 7, null],
    ]);
    const history = await workouts.getHistory(profileId, { limit: 10 });
    expect(history).toEqual([
      expect.objectContaining({
        id: workout.id,
        durationS: 3120,
        exerciseCount: 1,
        completedSetCount: 2,
      }),
    ]);
  });

  it('validates sets in the service, not only in the UI', async () => {
    const { workouts, profileId } = await setup();
    const workout = await workouts.startFree(profileId);
    await workouts.addExercise(profileId, workout.id, 'sys.bench-press');
    const setId = (await workouts.getActive(profileId))!.exercises[0]!.sets[0]!.id;

    // Drafts may be incomplete, but never out of range.
    await expect(
      workouts.updateSet(profileId, setId, { ...EMPTY_SET_VALUES, reps: 8 }, false),
    ).resolves.toBeUndefined();
    const incomplete = await workouts
      .updateSet(profileId, setId, { ...EMPTY_SET_VALUES, reps: 8 }, true)
      .catch((e: unknown) => e);
    expect(incomplete).toBeInstanceOf(TrainingError);
    expect((incomplete as TrainingError).setErrors).toEqual([
      { field: 'weightKg', problem: 'required' },
    ]);
    expect(
      await code(
        workouts.updateSet(
          profileId,
          setId,
          { ...EMPTY_SET_VALUES, weightKg: 80, reps: -1 },
          false,
        ),
      ),
    ).toBe('invalid-set');
    expect(
      await code(
        workouts.updateSet(
          profileId,
          setId,
          { ...EMPTY_SET_VALUES, weightKg: 80, reps: 8, rpe: 11 },
          true,
        ),
      ),
    ).toBe('invalid-set');
  });

  it('keeps an active workout across restarts (new service instances)', async () => {
    const { db, workouts, profileId } = await setup();
    const workout = await workouts.startFree(profileId);
    await workouts.addExercise(profileId, workout.id, 'sys.back-squat');
    const restarted = new WorkoutService(new TrainingStore(db), clock);
    const active = await restarted.getActive(profileId);
    expect(active?.id).toBe(workout.id);
    expect(active?.exercises[0]?.nameEn).toBe('Back Squat');
  });

  it('shows the last performance and pre-fills from it', async () => {
    const { workouts, profileId } = await setup();
    const first = await workouts.startFree(profileId);
    await workouts.addExercise(profileId, first.id, 'sys.bench-press');
    const setId = (await workouts.getActive(profileId))!.exercises[0]!.sets[0]!.id;
    await workouts.updateSet(
      profileId,
      setId,
      { ...EMPTY_SET_VALUES, weightKg: 80, reps: 8 },
      true,
    );
    await workouts.finish(profileId, first.id);

    advance(24 * 60);
    const second = await workouts.startFree(profileId);
    const last = await workouts.lastPerformance(profileId, 'sys.bench-press', second.id);
    expect(last).toMatchObject({
      workoutId: first.id,
      sets: [expect.objectContaining({ weightKg: 80, reps: 8 })],
    });
    await workouts.addExercise(profileId, second.id, 'sys.bench-press');
    const prefilled = (await workouts.getActive(profileId))!.exercises[0]!.sets[0]!;
    expect(prefilled).toMatchObject({ weightKg: 80, reps: 8, completed: false });
  });

  it('discards an active workout and deletes completed ones completely', async () => {
    const { db, workouts, profileId } = await setup();
    const a = await workouts.startFree(profileId);
    await workouts.addExercise(profileId, a.id, 'sys.bench-press');
    await workouts.discard(profileId, a.id);
    expect(await workouts.getActive(profileId)).toBeNull();

    const b = await workouts.startFree(profileId);
    await workouts.addExercise(profileId, b.id, 'sys.bench-press');
    await workouts.finish(profileId, b.id);
    await workouts.delete(profileId, b.id);
    for (const table of ['workouts', 'workout_exercises', 'workout_sets']) {
      const rows = await db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
      expect(rows[0]?.n, table).toBe(0);
    }
  });

  it('edits sets and details of a completed workout', async () => {
    const { workouts, profileId } = await setup();
    const w = await workouts.startFree(profileId);
    await workouts.addExercise(profileId, w.id, 'sys.bench-press');
    const setId = (await workouts.getActive(profileId))!.exercises[0]!.sets[0]!.id;
    await workouts.updateSet(
      profileId,
      setId,
      { ...EMPTY_SET_VALUES, weightKg: 80, reps: 8 },
      true,
    );
    await workouts.finish(profileId, w.id);

    await workouts.updateSet(
      profileId,
      setId,
      { ...EMPTY_SET_VALUES, weightKg: 82.5, reps: 8 },
      true,
    );
    await workouts.updateDetails(profileId, w.id, '  Push A ', 'felt strong');
    const detail = await workouts.getDetail(profileId, w.id);
    expect(detail).toMatchObject({ title: 'Push A', notes: 'felt strong', status: 'completed' });
    expect(detail.exercises[0]!.sets[0]!.weightKg).toBe(82.5);
  });

  it('refuses types that are not available yet', async () => {
    const { workouts, profileId } = await setup();
    expect(await code(workouts.startFree(profileId, 'running'))).toBe('unavailable-training-type');
    expect(await code(workouts.startFree(profileId, 'quidditch'))).toBe('unknown-training-type');
  });
});

describe('plans', () => {
  async function pushPullLegs(ctx: Awaited<ReturnType<typeof setup>>) {
    const plan = await ctx.plans.createPlan(ctx.profileId, 'Push/Pull/Legs');
    const push = await ctx.plans.addDay(ctx.profileId, plan.id, 'Push A');
    const pull = await ctx.plans.addDay(ctx.profileId, plan.id, 'Pull A');
    const bench = await ctx.plans.addExercise(ctx.profileId, push, 'sys.bench-press');
    await ctx.plans.addExercise(ctx.profileId, push, 'sys.overhead-press');
    await ctx.plans.addExercise(ctx.profileId, push, 'sys.triceps-pushdown');
    await ctx.plans.setTargets(ctx.profileId, bench, 3, 8);
    await ctx.plans.addExercise(ctx.profileId, pull, 'sys.pull-up');
    return { plan, push, pull, bench };
  }

  it('builds, reorders and edits a plan', async () => {
    const ctx = await setup();
    const { plan, push, bench } = await pushPullLegs(ctx);
    await ctx.plans.moveExercise(ctx.profileId, bench, 1);
    await ctx.plans.moveDay(ctx.profileId, push, 1);
    await ctx.plans.renamePlan(ctx.profileId, plan.id, 'PPL');
    const detail = await ctx.plans.getPlan(ctx.profileId, plan.id);
    expect(detail.name).toBe('PPL');
    expect(detail.days.map((d) => d.name)).toEqual(['Pull A', 'Push A']);
    expect(detail.days[1]!.exercises.map((e) => e.exerciseId)).toEqual([
      'sys.overhead-press',
      'sys.bench-press',
      'sys.triceps-pushdown',
    ]);
    const planned = detail.days[1]!.exercises.find((e) => e.id === bench);
    expect(planned).toMatchObject({ targetSets: 3, targetReps: 8, position: 1 });

    await ctx.plans.removeExercise(ctx.profileId, bench);
    const after = await ctx.plans.getPlan(ctx.profileId, plan.id);
    expect(after.days[1]!.exercises.map((e) => e.position)).toEqual([0, 1]);
    expect(
      await code(ctx.plans.setTargets(ctx.profileId, after.days[1]!.exercises[0]!.id, 0, 8)),
    ).toBe('invalid-value');
  });

  it('starts a workout from a plan day with targets and suggests the next day', async () => {
    const ctx = await setup();
    const { plan, push, pull } = await pushPullLegs(ctx);
    expect(await ctx.plans.nextWorkout(ctx.profileId)).toMatchObject({
      dayId: push,
      dayName: 'Push A',
    });

    const workout = await ctx.workouts.startFromPlan(ctx.profileId, push);
    const active = await ctx.workouts.getActive(ctx.profileId);
    expect(active).toMatchObject({
      planId: plan.id,
      planName: 'Push/Pull/Legs',
      planDayName: 'Push A',
    });
    expect(active!.exercises.map((e) => e.nameEn)).toEqual([
      'Bench Press',
      'Overhead Press',
      'Triceps Pushdown',
    ]);
    expect(active!.exercises[0]!.sets.map((s) => s.reps)).toEqual([8, 8, 8]);
    await ctx.workouts.finish(ctx.profileId, workout.id);
    expect(await ctx.plans.nextWorkout(ctx.profileId)).toMatchObject({
      dayId: pull,
      dayName: 'Pull A',
    });
  });

  it('keeps history intact when a plan is edited or deleted', async () => {
    const ctx = await setup();
    const { plan, push } = await pushPullLegs(ctx);
    const workout = await ctx.workouts.startFromPlan(ctx.profileId, push);
    const setId = (await ctx.workouts.getActive(ctx.profileId))!.exercises[0]!.sets[0]!.id;
    await ctx.workouts.updateSet(
      ctx.profileId,
      setId,
      { ...EMPTY_SET_VALUES, weightKg: 80, reps: 8 },
      true,
    );
    await ctx.workouts.finish(ctx.profileId, workout.id);
    const before = await ctx.workouts.getDetail(ctx.profileId, workout.id);

    await ctx.plans.renameDay(ctx.profileId, push, 'Brust & Schultern');
    await ctx.plans.renamePlan(ctx.profileId, plan.id, 'Neuer Plan');
    await ctx.plans.deletePlan(ctx.profileId, plan.id);

    const after = await ctx.workouts.getDetail(ctx.profileId, workout.id);
    expect(after).toMatchObject({
      planId: null,
      planDayId: null,
      planName: 'Push/Pull/Legs',
      planDayName: 'Push A',
    });
    expect(after.exercises).toEqual(before.exercises);
    expect(await ctx.plans.listPlans(ctx.profileId)).toEqual([]);
  });

  it('keeps history intact when a user exercise is renamed or deactivated', async () => {
    const ctx = await setup();
    const own = await ctx.exercises.create(ctx.profileId, {
      name: 'Landmine Press',
      exerciseType: 'weighted',
      equipment: 'barbell',
      movementPattern: 'verticalPush',
      primaryMuscles: ['shoulders'],
    });
    const w = await ctx.workouts.startFree(ctx.profileId);
    await ctx.workouts.addExercise(ctx.profileId, w.id, own.id);
    await ctx.workouts.finish(ctx.profileId, w.id);

    await ctx.exercises.update(ctx.profileId, own.id, {
      name: 'Renamed',
      exerciseType: 'bodyweight',
      equipment: 'bodyweight',
      movementPattern: 'other',
      primaryMuscles: [],
    });
    await ctx.exercises.setActive(ctx.profileId, own.id, false);

    const detail = await ctx.workouts.getDetail(ctx.profileId, w.id);
    expect(detail.exercises[0]).toMatchObject({
      exerciseId: own.id,
      nameDe: 'Landmine Press',
      exerciseType: 'weighted',
    });
    const next = await ctx.workouts.startFree(ctx.profileId);
    expect(await code(ctx.workouts.addExercise(ctx.profileId, next.id, own.id))).toBe(
      'exercise-inactive',
    );
  });

  it('refuses empty plan days and foreign ids', async () => {
    const ctx = await setup();
    const plan = await ctx.plans.createPlan(ctx.profileId, 'Empty');
    const day = await ctx.plans.addDay(ctx.profileId, plan.id, 'Day');
    expect(await code(ctx.workouts.startFromPlan(ctx.profileId, day))).toBe('empty-plan-day');
    expect(await code(ctx.plans.renameDay('someone-else', day, 'x'))).toBe('not-found');
    expect(await code(ctx.workouts.startFromPlan('someone-else', day))).toBe('not-found');
  });
});

describe('training schema', () => {
  it('upgrades a version 3 database with weight data without loss', async () => {
    const db = await openSqlJsDriver();
    await migrate(db, migrations.slice(0, 3));
    await db.run("INSERT INTO profiles (id, created_at, updated_at) VALUES ('p', 'x', 'x')");
    await db.run(
      "INSERT INTO weight_entries (id, profile_id, date, value, created_at, updated_at) VALUES ('w', 'p', '2026-10-01', 82.4, 'x', 'x')",
    );
    expect(await migrate(db, migrations)).toEqual([4, 5, 6, 7, 8]);
    expect(await db.query('SELECT date, value FROM weight_entries')).toEqual([
      { date: '2026-10-01', value: 82.4 },
    ]);
  });

  it('allows only one active workout per profile', async () => {
    const { db, workouts, profileId } = await setup();
    await workouts.startFree(profileId);
    await expect(
      db.run(
        "INSERT INTO workouts (id, profile_id, training_type, status, started_at, local_date, created_at, updated_at) VALUES ('x', ?, 'strength', 'active', 'x', '2026-10-03', 'x', 'x')",
        [profileId],
      ),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('uses indexes for history and last-performance queries', async () => {
    const { db, profileId } = await setup();
    const plan = async (sql: string, params: (string | number)[]) =>
      (await db.query<{ detail: string }>(`EXPLAIN QUERY PLAN ${sql}`, params))
        .map((r) => r.detail)
        .join(' | ');
    expect(
      await plan(
        "SELECT * FROM workouts WHERE profile_id = ? AND status = 'completed' ORDER BY started_at DESC LIMIT 20",
        [profileId],
      ),
    ).toMatch(/USING INDEX workouts_history/);
    expect(
      await plan('SELECT * FROM workout_exercises WHERE exercise_id = ?', ['sys.bench-press']),
    ).toMatch(/USING INDEX workout_exercises_exercise/);
  });

  it('handles many workouts with paged history', async () => {
    const { workouts, profileId } = await setup();
    for (let i = 0; i < 60; i += 1) {
      const w = await workouts.startFree(profileId);
      advance(60);
      await workouts.finish(profileId, w.id);
      advance(24 * 60);
    }
    const page = await workouts.getHistory(profileId, { limit: 20, offset: 20 });
    expect(page).toHaveLength(20);
    expect(await workouts.countHistory(profileId)).toBe(60);
    expect(await workouts.countHistory(profileId, 'running')).toBe(0);
    expect(page[0]!.startedAt > page[19]!.startedAt).toBe(true);
  });
});
