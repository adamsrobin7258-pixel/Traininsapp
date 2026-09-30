import type { Migration } from './types';

/**
 * Training system: exercise catalog, plans (what should be trained) and workouts (what was
 * trained). Workouts are historical snapshots and survive changes to plans and exercises:
 * - deleting a plan sets workouts.plan_id / plan_day_id to NULL; snapshot names stay,
 * - exercises are never deleted, only deactivated; workout_exercises keep name/type snapshots,
 * - only deleting a workout removes its exercises and sets.
 * training_type is free text on purpose: new sports need no migration (see trainingTypes.ts).
 */
export const migration004Training: Migration = {
  version: 4,
  name: 'training',
  up: `
    CREATE TABLE exercises (
      id               TEXT PRIMARY KEY NOT NULL,
      source           TEXT NOT NULL CHECK (source IN ('system', 'user')),
      profile_id       TEXT REFERENCES profiles(id) ON DELETE CASCADE,
      name_de          TEXT NOT NULL,
      name_en          TEXT NOT NULL,
      exercise_type    TEXT NOT NULL,
      equipment        TEXT NOT NULL,
      movement_pattern TEXT NOT NULL,
      instructions_de  TEXT,
      instructions_en  TEXT,
      active           INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL,
      sync_state       TEXT NOT NULL DEFAULT 'local'
                       CHECK (sync_state IN ('local', 'pending', 'synced')),
      CHECK ((source = 'system') = (profile_id IS NULL))
    );
    CREATE INDEX exercises_profile ON exercises (profile_id, active);

    CREATE TABLE exercise_muscles (
      exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      muscle      TEXT NOT NULL,
      role        TEXT NOT NULL CHECK (role IN ('primary', 'secondary')),
      PRIMARY KEY (exercise_id, muscle)
    );

    CREATE TABLE training_plans (
      id            TEXT PRIMARY KEY NOT NULL,
      profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      training_type TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      sync_state    TEXT NOT NULL DEFAULT 'local'
                    CHECK (sync_state IN ('local', 'pending', 'synced'))
    );
    CREATE INDEX training_plans_profile ON training_plans (profile_id, updated_at);

    CREATE TABLE training_plan_days (
      id         TEXT PRIMARY KEY NOT NULL,
      plan_id    TEXT NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      position   INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX training_plan_days_plan ON training_plan_days (plan_id, position);

    CREATE TABLE planned_exercises (
      id          TEXT PRIMARY KEY NOT NULL,
      day_id      TEXT NOT NULL REFERENCES training_plan_days(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercises(id),
      position    INTEGER NOT NULL,
      target_sets INTEGER CHECK (target_sets BETWEEN 1 AND 20),
      target_reps INTEGER CHECK (target_reps BETWEEN 1 AND 100),
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE INDEX planned_exercises_day ON planned_exercises (day_id, position);

    CREATE TABLE workouts (
      id                TEXT PRIMARY KEY NOT NULL,
      profile_id        TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      training_type     TEXT NOT NULL,
      status            TEXT NOT NULL CHECK (status IN ('active', 'completed')),
      title             TEXT,
      notes             TEXT,
      started_at        TEXT NOT NULL,
      ended_at          TEXT,
      duration_s        INTEGER CHECK (duration_s >= 0),
      local_date        TEXT NOT NULL,
      plan_id           TEXT REFERENCES training_plans(id) ON DELETE SET NULL,
      plan_day_id       TEXT REFERENCES training_plan_days(id) ON DELETE SET NULL,
      plan_name         TEXT,
      plan_day_name     TEXT,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL,
      sync_state        TEXT NOT NULL DEFAULT 'local'
                        CHECK (sync_state IN ('local', 'pending', 'synced')),
      CHECK ((status = 'completed') = (ended_at IS NOT NULL))
    );
    -- History (newest first), filterable by training type.
    CREATE INDEX workouts_history ON workouts (profile_id, status, started_at);
    CREATE INDEX workouts_type ON workouts (profile_id, training_type, started_at);
    CREATE INDEX workouts_plan_day ON workouts (plan_id, started_at);
    -- At most one workout in progress per profile.
    CREATE UNIQUE INDEX workouts_one_active ON workouts (profile_id) WHERE status = 'active';

    CREATE TABLE workout_exercises (
      id            TEXT PRIMARY KEY NOT NULL,
      workout_id    TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      exercise_id   TEXT REFERENCES exercises(id) ON DELETE SET NULL,
      position      INTEGER NOT NULL,
      name_de       TEXT NOT NULL,
      name_en       TEXT NOT NULL,
      exercise_type TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
    CREATE INDEX workout_exercises_workout ON workout_exercises (workout_id, position);
    -- "Last time" lookups per exercise.
    CREATE INDEX workout_exercises_exercise ON workout_exercises (exercise_id);

    CREATE TABLE workout_sets (
      id                  TEXT PRIMARY KEY NOT NULL,
      workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
      position            INTEGER NOT NULL,
      weight_kg           REAL CHECK (weight_kg BETWEEN 0 AND 1000),
      reps                INTEGER CHECK (reps BETWEEN 1 AND 500),
      duration_s          INTEGER CHECK (duration_s BETWEEN 1 AND 86400),
      distance_m          REAL CHECK (distance_m BETWEEN 1 AND 100000),
      rpe                 REAL CHECK (rpe BETWEEN 1 AND 10),
      completed           INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL
    );
    CREATE INDEX workout_sets_exercise ON workout_sets (workout_exercise_id, position);
  `,
};
