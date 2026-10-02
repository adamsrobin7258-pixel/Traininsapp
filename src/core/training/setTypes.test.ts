import { migrate, migrations } from '@/core/database';
import { openSqlJsDriver } from '@/core/database/drivers/sqlJs';
import { ProfileRepository, ProfileService } from '@/core/user';
import { createTestDatabase, fixedClock } from '@/test/database';
import { TrainingError } from './errors';
import { ExerciseService } from './exerciseService';
import { summarizeSets, totalVolumeKg } from './metrics';
import { PlanService } from './planService';
import { EMPTY_SET_VALUES, groupSets, type SetValues } from './sets';
import { TrainingStore } from './trainingStore';
import { WorkoutService } from './workoutService';

const clock = () => new Date('2026-10-03T08:00:00.000Z');

async function setup() {
  const db = await createTestDatabase();
  const profile = await new ProfileService(
    new ProfileRepository(db),
    fixedClock(),
  ).ensureLocalProfile();
  const store = new TrainingStore(db);
  await new ExerciseService(store, clock).ensureCatalog();
  return {
    db,
    plans: new PlanService(store, clock),
    workouts: new WorkoutService(store, clock),
    profileId: profile.id,
  };
}

const values = (weightKg: number, reps: number): SetValues => ({
  ...EMPTY_SET_VALUES,
  weightKg,
  reps,
});

type Ctx = Awaited<ReturnType<typeof setup>>;

/** Plan "Tag A" with squats: 2 warm-ups, 3 × 8 working sets, 2 drops after the last one. */
async function planWithSetTypes(ctx: Ctx) {
  const plan = await ctx.plans.createPlan(ctx.profileId, 'Kraft');
  const day = await ctx.plans.addDay(ctx.profileId, plan.id, 'Tag A');
  const planned = await ctx.plans.addExercise(ctx.profileId, day, 'sys.back-squat');
  await ctx.plans.configure(ctx.profileId, planned, {
    targetSets: 3,
    targetReps: 8,
    warmupSets: 2,
    dropSets: 2,
  });
  return { plan, day, planned };
}

async function onlyExercise(ctx: Ctx, workoutId: string) {
  const detail = await ctx.workouts.getDetail(ctx.profileId, workoutId);
  const exercise = detail.exercises[0];
  if (!exercise) throw new Error('exercise expected');
  return exercise;
}

describe('set types in plans', () => {
  it('stores warm-ups and drops with a planned exercise', async () => {
    const ctx = await setup();
    const { plan } = await planWithSetTypes(ctx);
    const detail = await ctx.plans.getPlan(ctx.profileId, plan.id);
    expect(detail.days[0]?.exercises[0]).toMatchObject({
      targetSets: 3,
      targetReps: 8,
      warmupSets: 2,
      dropSets: 2,
    });
  });

  it('keeps warm-ups and drops when only sets × reps change', async () => {
    const ctx = await setup();
    const { plan, planned } = await planWithSetTypes(ctx);
    await ctx.plans.setTargets(ctx.profileId, planned, 4, 6);
    const detail = await ctx.plans.getPlan(ctx.profileId, plan.id);
    expect(detail.days[0]?.exercises[0]).toMatchObject({
      targetSets: 4,
      targetReps: 6,
      warmupSets: 2,
      dropSets: 2,
    });
  });

  it('rejects out-of-range warm-ups and drops', async () => {
    const ctx = await setup();
    const { planned } = await planWithSetTypes(ctx);
    const base = { targetSets: 3, targetReps: 8, warmupSets: null, dropSets: null };
    for (const targets of [
      { ...base, warmupSets: 0 },
      { ...base, warmupSets: 11 },
      { ...base, dropSets: 6 },
      { ...base, dropSets: 1.5 },
    ]) {
      await expect(ctx.plans.configure(ctx.profileId, planned, targets)).rejects.toThrow(
        TrainingError,
      );
    }
  });
});

describe('set types in workouts', () => {
  it('copies warm-ups, working sets and a linked drop chain into the workout', async () => {
    const ctx = await setup();
    const { day } = await planWithSetTypes(ctx);
    const workout = await ctx.workouts.startFromPlan(ctx.profileId, day);
    const exercise = await onlyExercise(ctx, workout.id);

    expect(exercise.sets.map((set) => set.setType)).toEqual([
      'warmup',
      'warmup',
      'working',
      'working',
      'working',
      'drop',
      'drop',
    ]);
    const { warmups, working } = groupSets(exercise.sets);
    expect(warmups).toHaveLength(2);
    expect(working.map((group) => group.drops.length)).toEqual([0, 0, 2]);
    const lastWorking = working[2]?.set;
    expect(working[2]?.drops.map((drop) => drop.dropOf)).toEqual([
      lastWorking?.id,
      lastWorking?.id,
    ]);
    // Target reps pre-fill working sets only.
    expect(working.map((group) => group.set.reps)).toEqual([8, 8, 8]);
    expect(warmups.every((set) => set.reps === null)).toBe(true);
  });

  it('stores set types, keeps drop order and pre-fills the next workout by type', async () => {
    const ctx = await setup();
    const { day } = await planWithSetTypes(ctx);
    const first = await ctx.workouts.startFromPlan(ctx.profileId, day);
    const sets = (await onlyExercise(ctx, first.id)).sets;
    const loads = [
      [40, 10],
      [60, 5],
      [100, 8],
      [100, 8],
      [100, 7],
      [70, 6],
      [50, 7],
    ] as const;
    for (const [index, set] of sets.entries()) {
      const [weight, reps] = loads[index] ?? [0, 0];
      await ctx.workouts.updateSet(ctx.profileId, set.id, values(weight, reps), true);
    }
    await ctx.workouts.finish(ctx.profileId, first.id);

    const rows = await ctx.db.query<{ set_type: string; weight_kg: number; drop_of: string }>(
      'SELECT set_type, weight_kg, drop_of FROM workout_sets ORDER BY position',
    );
    expect(rows.map((row) => [row.set_type, row.weight_kg])).toEqual([
      ['warmup', 40],
      ['warmup', 60],
      ['working', 100],
      ['working', 100],
      ['working', 100],
      ['drop', 70],
      ['drop', 50],
    ]);

    const second = await ctx.workouts.startFromPlan(ctx.profileId, day);
    const next = groupSets((await onlyExercise(ctx, second.id)).sets);
    expect(next.warmups.map((set) => set.weightKg)).toEqual([40, 60]);
    expect(next.working.map((group) => group.set.reps)).toEqual([8, 8, 7]);
    expect(next.working[2]?.drops.map((drop) => [drop.weightKg, drop.reps])).toEqual([
      [70, 6],
      [50, 7],
    ]);
  });

  it('does not count warm-ups as working sets or volume; drops add volume only', async () => {
    const ctx = await setup();
    const { day } = await planWithSetTypes(ctx);
    const workout = await ctx.workouts.startFromPlan(ctx.profileId, day);
    const sets = (await onlyExercise(ctx, workout.id)).sets;
    const loads = [
      [40, 10],
      [60, 5],
      [100, 8],
      [100, 8],
      [100, 7],
      [70, 6],
      [50, 7],
    ] as const;
    for (const [index, set] of sets.entries()) {
      const [weight, reps] = loads[index] ?? [0, 0];
      await ctx.workouts.updateSet(ctx.profileId, set.id, values(weight, reps), true);
    }
    const done = (await onlyExercise(ctx, workout.id)).sets;
    const summary = summarizeSets(done, 'weighted');
    expect(summary.completedSets).toBe(3);
    expect(summary.heaviestKg).toBe(100);
    // 3 working sets (800 + 800 + 700) + drops (420 + 350); warm-ups (400 + 300) excluded.
    expect(summary.volumeKg).toBe(3070);
    expect(totalVolumeKg(done)).toBe(3070);

    await ctx.workouts.finish(ctx.profileId, workout.id);
    const [history] = await ctx.workouts.getHistory(ctx.profileId, { limit: 1 });
    expect(history?.completedSetCount).toBe(3);
  });

  it('adds warm-ups before working sets and drops after their working set', async () => {
    const ctx = await setup();
    const workout = await ctx.workouts.startFree(ctx.profileId);
    const exerciseId = await ctx.workouts.addExercise(ctx.profileId, workout.id, 'sys.bench-press');
    await ctx.workouts.addSet(ctx.profileId, exerciseId); // second working set
    const workingIds = groupSets((await onlyExercise(ctx, workout.id)).sets).working.map(
      (group) => group.set.id,
    );
    const firstWorking = workingIds[0] ?? '';
    await ctx.workouts.addDrop(ctx.profileId, firstWorking);
    await ctx.workouts.addDrop(ctx.profileId, firstWorking);
    await ctx.workouts.addSet(ctx.profileId, exerciseId, 'warmup');
    await ctx.workouts.addSet(ctx.profileId, exerciseId, 'warmup');

    const sets = (await onlyExercise(ctx, workout.id)).sets;
    expect(sets.map((set) => set.setType)).toEqual([
      'warmup',
      'warmup',
      'working',
      'drop',
      'drop',
      'working',
    ]);
    expect(sets.map((set) => set.position)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(sets[3]?.dropOf).toBe(firstWorking);

    // Drops only continue working sets.
    const warmup = sets[0]?.id ?? '';
    await expect(ctx.workouts.addDrop(ctx.profileId, warmup)).rejects.toThrow(TrainingError);
    // Deleting a working set removes its drops, nothing else.
    await ctx.workouts.deleteSet(ctx.profileId, firstWorking);
    expect((await onlyExercise(ctx, workout.id)).sets.map((set) => set.setType)).toEqual([
      'warmup',
      'warmup',
      'working',
    ]);
  });

  it('drops empty placeholders on finish but keeps a set whose drop has values', async () => {
    const ctx = await setup();
    const workout = await ctx.workouts.startFree(ctx.profileId);
    const exerciseId = await ctx.workouts.addExercise(ctx.profileId, workout.id, 'sys.bench-press');
    const [working] = (await onlyExercise(ctx, workout.id)).sets;
    await ctx.workouts.updateSet(ctx.profileId, working?.id ?? '', values(100, 8), true);
    const drop = await ctx.workouts.addDrop(ctx.profileId, working?.id ?? '');
    await ctx.workouts.addDrop(ctx.profileId, working?.id ?? ''); // stays empty
    await ctx.workouts.updateSet(ctx.profileId, drop, values(70, 6), true);
    await ctx.workouts.addSet(ctx.profileId, exerciseId, 'warmup'); // stays empty
    await ctx.workouts.finish(ctx.profileId, workout.id);

    const sets = (await onlyExercise(ctx, workout.id)).sets;
    expect(sets.map((set) => [set.setType, set.weightKg])).toEqual([
      ['working', 100],
      ['drop', 70],
    ]);
  });

  it('keeps existing sets and RPE values unchanged', async () => {
    const ctx = await setup();
    const workout = await ctx.workouts.startFree(ctx.profileId);
    await ctx.workouts.addExercise(ctx.profileId, workout.id, 'sys.bench-press');
    const [set] = (await onlyExercise(ctx, workout.id)).sets;
    await ctx.workouts.updateSet(ctx.profileId, set?.id ?? '', { ...values(80, 8), rpe: 8 }, true);
    const [stored] = (await onlyExercise(ctx, workout.id)).sets;
    expect(stored).toMatchObject({ setType: 'working', dropOf: null, rpe: 8, weightKg: 80 });
  });
});

describe('migration 5', () => {
  it('turns every existing set into a working set without losing data', async () => {
    const db = await openSqlJsDriver();
    await migrate(db, migrations.slice(0, 4));
    await db.execute(`
      INSERT INTO profiles (id, created_at, updated_at) VALUES ('p', 'x', 'x');
      INSERT INTO exercises (id, source, name_de, name_en, exercise_type, equipment,
        movement_pattern, created_at, updated_at)
        VALUES ('sys.bench-press', 'system', 'Bankdrücken', 'Bench Press', 'weighted', 'barbell',
        'horizontalPush', 'x', 'x');
      INSERT INTO training_plans (id, profile_id, name, training_type, created_at, updated_at)
        VALUES ('plan', 'p', 'Alt', 'strength', 'x', 'x');
      INSERT INTO training_plan_days (id, plan_id, name, position, created_at, updated_at)
        VALUES ('day', 'plan', 'Tag', 0, 'x', 'x');
      INSERT INTO planned_exercises (id, day_id, exercise_id, position, target_sets, target_reps,
        created_at, updated_at) VALUES ('pe', 'day', 'sys.bench-press', 0, 3, 8, 'x', 'x');
      INSERT INTO workouts (id, profile_id, training_type, status, started_at, ended_at,
        duration_s, local_date, created_at, updated_at)
        VALUES ('w', 'p', 'strength', 'completed', 'x', 'y', 60, '2026-09-30', 'x', 'x');
      INSERT INTO workout_exercises (id, workout_id, exercise_id, position, name_de, name_en,
        exercise_type, created_at, updated_at)
        VALUES ('we', 'w', 'sys.bench-press', 0, 'Bankdrücken', 'Bench Press', 'weighted', 'x', 'x');
      INSERT INTO workout_sets (id, workout_exercise_id, position, weight_kg, reps, rpe,
        completed, created_at, updated_at) VALUES ('s1', 'we', 0, 80, 8, 8, 1, 'x', 'x');
    `);

    expect(await migrate(db, migrations)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(
      await db.query('SELECT id, weight_kg, reps, rpe, set_type, drop_of FROM workout_sets'),
    ).toEqual([{ id: 's1', weight_kg: 80, reps: 8, rpe: 8, set_type: 'working', drop_of: null }]);
    expect(
      await db.query(
        'SELECT target_sets, target_reps, warmup_sets, drop_sets FROM planned_exercises',
      ),
    ).toEqual([{ target_sets: 3, target_reps: 8, warmup_sets: null, drop_sets: null }]);
  });

  it('enforces the drop link in the database', async () => {
    const ctx = await setup();
    const workout = await ctx.workouts.startFree(ctx.profileId);
    const exerciseId = await ctx.workouts.addExercise(ctx.profileId, workout.id, 'sys.bench-press');
    const insert = (type: string, dropOf: string | null) =>
      ctx.db.run(
        `INSERT INTO workout_sets (id, workout_exercise_id, position, completed, set_type, drop_of,
           created_at, updated_at) VALUES (?, ?, 9, 0, ?, ?, 'x', 'x')`,
        [`x-${type}-${String(dropOf)}`, exerciseId, type, dropOf],
      );
    await expect(insert('drop', null)).rejects.toThrow(/CHECK/);
    await expect(insert('superset', null)).rejects.toThrow(/CHECK/);
    const [working] = (await onlyExercise(ctx, workout.id)).sets;
    await expect(insert('working', working?.id ?? null)).rejects.toThrow(/CHECK/);
  });
});
