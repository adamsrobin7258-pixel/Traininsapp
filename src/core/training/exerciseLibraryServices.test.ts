import { migrate, migrations } from '@/core/database';
import { openSqlJsDriver } from '@/core/database/drivers/sqlJs';
import { ProfileRepository, ProfileService } from '@/core/user';
import { createTestDatabase, fixedClock } from '@/test/database';
import { EXERCISE_CATALOG, EXERCISE_CATALOG_VERSION } from './exerciseCatalog';
import { ExerciseService } from './exerciseService';
import { PlanService } from './planService';
import { TrainingStore } from './trainingStore';
import { WorkoutService } from './workoutService';

let now = new Date('2026-10-03T08:00:00.000Z');
const clock = () => now;
const advance = (minutes: number) => {
  now = new Date(now.getTime() + minutes * 60_000);
};

function services(db: Awaited<ReturnType<typeof createTestDatabase>>) {
  const store = new TrainingStore(db);
  return {
    exercises: new ExerciseService(store, clock),
    plans: new PlanService(store, clock),
    workouts: new WorkoutService(store, clock),
  };
}

async function setup() {
  now = new Date('2026-10-03T08:00:00.000Z');
  const db = await createTestDatabase();
  const profile = await new ProfileService(
    new ProfileRepository(db),
    fixedClock(),
  ).ensureLocalProfile();
  const s = services(db);
  await s.exercises.ensureCatalog();
  return { db, ...s, profileId: profile.id };
}

describe('exercise favourites', () => {
  it('adds, removes and keeps favourites across restarts', async () => {
    const { db, exercises, profileId } = await setup();
    expect(await exercises.favoriteIds(profileId)).toEqual([]);

    await exercises.setFavorite(profileId, 'sys.bench-press', true);
    advance(1);
    await exercises.setFavorite(profileId, 'sys.pull-up', true);
    // Marking twice changes nothing.
    await exercises.setFavorite(profileId, 'sys.pull-up', true);
    expect(await exercises.favoriteIds(profileId)).toEqual(['sys.bench-press', 'sys.pull-up']);

    // New service instances on the same database: favourites are persisted.
    const restarted = services(db);
    await restarted.exercises.ensureCatalog();
    expect(await restarted.exercises.favoriteIds(profileId)).toEqual([
      'sys.bench-press',
      'sys.pull-up',
    ]);

    await restarted.exercises.setFavorite(profileId, 'sys.bench-press', false);
    await restarted.exercises.setFavorite(profileId, 'sys.bench-press', false);
    expect(await restarted.exercises.favoriteIds(profileId)).toEqual(['sys.pull-up']);
  });

  it('supports user exercises and rejects unknown or foreign ones', async () => {
    const { db, exercises, profileId } = await setup();
    const own = await exercises.create(profileId, {
      name: 'Meine Presse',
      exerciseType: 'weighted',
      equipment: 'machine',
      movementPattern: 'horizontalPush',
      primaryMuscles: ['chest'],
    });
    await exercises.setFavorite(profileId, own.id, true);
    expect(await exercises.favoriteIds(profileId)).toEqual([own.id]);

    await expect(exercises.setFavorite(profileId, 'sys.unknown', true)).rejects.toThrow();
    await db.run("INSERT INTO profiles (id, created_at, updated_at) VALUES ('other', 'x', 'x')");
    await expect(exercises.setFavorite('other', own.id, true)).rejects.toThrow();
    expect(await exercises.favoriteIds('other')).toEqual([]);
  });

  it('removes favourites together with the profile', async () => {
    const { db, exercises, profileId } = await setup();
    await exercises.setFavorite(profileId, 'sys.bench-press', true);
    await db.run('DELETE FROM profiles WHERE id = ?', [profileId]);
    expect(await db.query('SELECT * FROM exercise_favorites')).toEqual([]);
  });
});

describe('recently used exercises', () => {
  it('derives the most recent exercises from the workout history', async () => {
    const { db, exercises, workouts, profileId } = await setup();
    expect(await exercises.recentIds(profileId)).toEqual([]);

    const first = await workouts.startFree(profileId);
    await workouts.addExercise(profileId, first.id, 'sys.back-squat');
    await workouts.addExercise(profileId, first.id, 'sys.bench-press');
    await workouts.finish(profileId, first.id);
    advance(60 * 24);
    const second = await workouts.startFree(profileId);
    await workouts.addExercise(profileId, second.id, 'sys.pull-up');
    await workouts.addExercise(profileId, second.id, 'sys.back-squat');

    const recent = await exercises.recentIds(profileId);
    expect(recent.slice(0, 2).sort()).toEqual(['sys.back-squat', 'sys.pull-up']);
    expect(recent[2]).toBe('sys.bench-press');
    // Each exercise once, no own table.
    expect(new Set(recent).size).toBe(recent.length);
    expect(await exercises.recentIds(profileId, 1)).toHaveLength(1);
    const tables = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%recent%'",
    );
    expect(tables).toEqual([]);
  });
});

describe('catalog upgrade', () => {
  it('seeds the catalog once: a restart does not insert again', async () => {
    const { db, exercises } = await setup();
    const count = async () =>
      (
        await db.query<{ n: number }>("SELECT COUNT(*) AS n FROM exercises WHERE source = 'system'")
      )[0]?.n;
    expect(await count()).toBe(EXERCISE_CATALOG.length);
    const before = await db.query<{ updated_at: string }>(
      "SELECT updated_at FROM exercises WHERE id = 'sys.bench-press'",
    );
    advance(5);
    await exercises.ensureCatalog();
    await services(db).exercises.ensureCatalog();
    expect(await count()).toBe(EXERCISE_CATALOG.length);
    // The version check skips the sync entirely.
    expect(await db.query("SELECT updated_at FROM exercises WHERE id = 'sys.bench-press'")).toEqual(
      before,
    );
    expect(
      await db.query("SELECT value FROM app_settings WHERE key = 'system.exerciseCatalogVersion'"),
    ).toEqual([{ value: String(EXERCISE_CATALOG_VERSION) }]);
  });

  it('upgrades the first catalog without touching user data, plans or history', async () => {
    now = new Date('2026-10-03T08:00:00.000Z');
    const db = await createTestDatabase();
    const profile = await new ProfileService(
      new ProfileRepository(db),
      fixedClock(),
    ).ensureLocalProfile();
    const profileId = profile.id;
    const old = services(db);

    // State of an installation with catalog version 1.
    await db.run(
      `INSERT INTO exercises (id, source, name_de, name_en, exercise_type, equipment,
         movement_pattern, active, created_at, updated_at)
       VALUES ('sys.bench-press', 'system', 'Bankdrücken', 'Bench Press', 'weighted', 'barbell',
         'horizontalPush', 1, 'x', 'x'),
       ('sys.removed-old', 'system', 'Alt', 'Old', 'weighted', 'other', 'other', 1, 'x', 'x')`,
    );
    await db.run(
      "INSERT INTO app_settings (key, value, updated_at) VALUES ('system.exerciseCatalogVersion', '1', 'x')",
    );
    const own = await old.exercises.create(profileId, {
      name: 'Meine Presse',
      exerciseType: 'weighted',
      equipment: 'machine',
      movementPattern: 'horizontalPush',
      primaryMuscles: ['chest'],
    });
    const plan = await old.plans.createPlan(profileId, 'Push');
    const dayId = await old.plans.addDay(profileId, plan.id, 'Tag A');
    await old.plans.addExercise(profileId, dayId, 'sys.bench-press');
    await old.plans.addExercise(profileId, dayId, own.id);
    const workout = await old.workouts.startFree(profileId);
    await old.workouts.addExercise(profileId, workout.id, 'sys.bench-press');
    await old.workouts.finish(profileId, workout.id);
    await old.exercises.setFavorite(profileId, 'sys.bench-press', true);

    const upgraded = services(db);
    await upgraded.exercises.ensureCatalog();

    // System exercise renamed in place: same ID, new names, description added.
    const bench = await upgraded.exercises.get('sys.bench-press');
    expect(bench).toMatchObject({
      nameDe: 'Langhantel-Bankdrücken',
      nameEn: 'Barbell Bench Press',
      active: true,
    });
    expect(bench?.instructionsDe).toMatch(/Flachbank/);
    expect(bench?.instructionsEn).toMatch(/flat bench/);
    // Exercises no longer in the catalog are only deactivated, never deleted.
    expect(await upgraded.exercises.get('sys.removed-old')).toMatchObject({ active: false });

    // User exercise unchanged and still editable.
    expect(await upgraded.exercises.get(own.id)).toMatchObject({
      source: 'user',
      nameDe: 'Meine Presse',
      instructionsDe: null,
    });
    await upgraded.exercises.update(profileId, own.id, {
      name: 'Meine Brustpresse',
      exerciseType: 'weighted',
      equipment: 'machine',
      movementPattern: 'horizontalPush',
      primaryMuscles: ['chest'],
    });
    expect((await upgraded.exercises.get(own.id))?.nameDe).toBe('Meine Brustpresse');

    // Plan keeps its exercises; a new library exercise can be added.
    await upgraded.plans.addExercise(profileId, dayId, 'sys.cable-fly');
    const detail = await upgraded.plans.getPlan(profileId, plan.id);
    expect(detail.days[0]?.exercises.map((e) => e.exerciseId)).toEqual([
      'sys.bench-press',
      own.id,
      'sys.cable-fly',
    ]);

    // Past workout keeps its name snapshot.
    const past = await upgraded.workouts.getDetail(profileId, workout.id);
    expect(past.exercises[0]).toMatchObject({
      exerciseId: 'sys.bench-press',
      nameDe: 'Bankdrücken',
      nameEn: 'Bench Press',
    });

    // Favourites survive and the full catalog is there.
    expect(await upgraded.exercises.favoriteIds(profileId)).toEqual(['sys.bench-press']);
    const list = await upgraded.exercises.list(profileId);
    expect(list.filter((e) => e.source === 'system')).toHaveLength(EXERCISE_CATALOG.length);
    expect(list.filter((e) => e.source === 'user')).toHaveLength(1);
  });
});

describe('migration 9', () => {
  it('adds the favourites table and keeps every existing row', async () => {
    const db = await openSqlJsDriver();
    await migrate(db, migrations.slice(0, 8));
    await db.run("INSERT INTO profiles (id, created_at, updated_at) VALUES ('p', 'x', 'x')");
    await db.run(
      `INSERT INTO exercises (id, source, profile_id, name_de, name_en, exercise_type, equipment,
         movement_pattern, active, created_at, updated_at)
       VALUES ('u', 'user', 'p', 'Eigene', 'Eigene', 'weighted', 'other', 'other', 1, 'x', 'x')`,
    );
    await db.run(
      "INSERT INTO workouts (id, profile_id, training_type, status, started_at, local_date, created_at, updated_at) VALUES ('w', 'p', 'strength', 'active', 'x', '2026-10-01', 'x', 'x')",
    );
    expect(await migrate(db, migrations)).toEqual([9, 10, 11, 12, 13, 14, 15]);
    expect(await db.query('SELECT id, name_de FROM exercises')).toEqual([
      { id: 'u', name_de: 'Eigene' },
    ]);
    expect(await db.query('SELECT id FROM workouts')).toEqual([{ id: 'w' }]);
    expect(await db.query('SELECT * FROM exercise_favorites')).toEqual([]);
    // Running the migrations again does nothing.
    expect(await migrate(db, migrations)).toEqual([]);
  });
});
