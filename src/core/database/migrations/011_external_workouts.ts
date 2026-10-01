import type { Migration } from './types';

/**
 * Activities imported from Health Connect (runs, rides, strength sessions recorded by a watch or
 * another app). Purely additive and strictly separate from Kalethra's own `workouts`: an
 * imported activity never counts as a Kalethra workout, plan progress or "next workout".
 *
 * - external_id: the record ID in Health Connect, unique per profile and platform – re-reads
 *   update the row instead of adding a duplicate.
 * - activity_type: the provider's type as reported (e.g. 'running'); `category` is Kalethra's
 *   broad family for icons and grouping ('other' when unknown).
 * - active_kcal, distance_m, steps: NULL when the source did not report them (never 0 instead).
 * - local_date: the local day of the start, for daily views and the optional calorie bonus.
 */
export const migration011ExternalWorkouts: Migration = {
  version: 11,
  name: 'external_workouts',
  up: `
    CREATE TABLE external_workouts (
      id             TEXT PRIMARY KEY NOT NULL,
      profile_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      platform       TEXT NOT NULL CHECK (platform IN ('healthConnect')),
      external_id    TEXT NOT NULL,
      activity_type  TEXT NOT NULL,
      category       TEXT NOT NULL,
      started_at     TEXT NOT NULL,
      ended_at       TEXT NOT NULL,
      local_date     TEXT NOT NULL CHECK (local_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      duration_s     INTEGER NOT NULL CHECK (duration_s > 0 AND duration_s <= 86400),
      active_kcal    REAL CHECK (active_kcal IS NULL OR (active_kcal >= 0 AND active_kcal <= 10000)),
      distance_m     REAL CHECK (distance_m IS NULL OR (distance_m >= 0 AND distance_m <= 1000000)),
      steps          INTEGER CHECK (steps IS NULL OR (steps >= 0 AND steps <= 200000)),
      source         TEXT,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );
    CREATE UNIQUE INDEX external_workouts_record
      ON external_workouts (profile_id, platform, external_id);
    CREATE INDEX external_workouts_profile_start ON external_workouts (profile_id, started_at);
    CREATE INDEX external_workouts_profile_date ON external_workouts (profile_id, local_date);
    CREATE INDEX external_workouts_profile_type ON external_workouts (profile_id, activity_type);
  `,
};
