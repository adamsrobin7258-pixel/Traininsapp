import type { Migration } from './types';

/**
 * Phase 9 – Kalethra score.
 *
 * - recovery_entries: the user's own daily recovery note (subjective, never interpreted
 *   medically) – one row per profile and day, purely additive.
 * - nutrition_goals: the main goal gains `fitness` (general fitness). SQLite cannot change a
 *   CHECK constraint, so the table is rebuilt with the same columns and every row copied
 *   unchanged; nothing references nutrition_goals, so no other table is touched.
 *
 * The score itself is never stored – it is calculated from these and the existing data.
 */
export const migration013RecoveryAndFitnessGoal: Migration = {
  version: 13,
  name: 'recovery_and_fitness_goal',
  up: `
    CREATE TABLE recovery_entries (
      id          TEXT PRIMARY KEY NOT NULL,
      profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      local_date  TEXT NOT NULL CHECK (local_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      state       TEXT CHECK (state IS NULL OR state IN ('poor', 'moderate', 'good')),
      rest_day    INTEGER NOT NULL DEFAULT 0 CHECK (rest_day IN (0, 1)),
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      CHECK (state IS NOT NULL OR rest_day = 1)
    );
    CREATE UNIQUE INDEX recovery_entries_day ON recovery_entries (profile_id, local_date);

    CREATE TABLE nutrition_goals_v13 (
      id               TEXT PRIMARY KEY NOT NULL,
      profile_id       TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      effective_from   TEXT NOT NULL,
      goal_type        TEXT NOT NULL CHECK (goal_type IN ('lose', 'maintain', 'gain', 'fitness')),
      energy_kcal_auto REAL CHECK (energy_kcal_auto >= 0),
      energy_kcal_manual REAL CHECK (energy_kcal_manual >= 0),
      protein_g_auto   REAL CHECK (protein_g_auto >= 0),
      protein_g_manual REAL CHECK (protein_g_manual >= 0),
      carbs_g_auto     REAL CHECK (carbs_g_auto >= 0),
      carbs_g_manual   REAL CHECK (carbs_g_manual >= 0),
      fat_g_auto       REAL CHECK (fat_g_auto >= 0),
      fat_g_manual     REAL CHECK (fat_g_manual >= 0),
      water_ml_auto    REAL CHECK (water_ml_auto >= 0),
      water_ml_manual  REAL CHECK (water_ml_manual >= 0),
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL,
      sync_state       TEXT NOT NULL DEFAULT 'local'
        CHECK (sync_state IN ('local', 'pending', 'synced')),
      goal_level       TEXT CHECK (goal_level IN ('slow', 'moderate', 'fast', 'higher')),
      activity_level   TEXT
        CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'veryActive')),
      include_training INTEGER NOT NULL DEFAULT 0 CHECK (include_training IN (0, 1)),
      target_weight_kg REAL CHECK (target_weight_kg > 0),
      auto_enabled     INTEGER NOT NULL DEFAULT 0 CHECK (auto_enabled IN (0, 1)),
      calculation      TEXT
    );
    INSERT INTO nutrition_goals_v13 (id, profile_id, effective_from, goal_type,
      energy_kcal_auto, energy_kcal_manual, protein_g_auto, protein_g_manual,
      carbs_g_auto, carbs_g_manual, fat_g_auto, fat_g_manual, water_ml_auto, water_ml_manual,
      created_at, updated_at, sync_state, goal_level, activity_level, include_training,
      target_weight_kg, auto_enabled, calculation)
    SELECT id, profile_id, effective_from, goal_type,
      energy_kcal_auto, energy_kcal_manual, protein_g_auto, protein_g_manual,
      carbs_g_auto, carbs_g_manual, fat_g_auto, fat_g_manual, water_ml_auto, water_ml_manual,
      created_at, updated_at, sync_state, goal_level, activity_level, include_training,
      target_weight_kg, auto_enabled, calculation
    FROM nutrition_goals;
    DROP TABLE nutrition_goals;
    ALTER TABLE nutrition_goals_v13 RENAME TO nutrition_goals;
    CREATE UNIQUE INDEX nutrition_goals_day ON nutrition_goals (profile_id, effective_from);
  `,
};
