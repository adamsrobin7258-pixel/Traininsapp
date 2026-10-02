import type { Migration } from './types';

/**
 * Sport and movement activities the user logs by hand. Purely additive and kept apart from both
 * other sources: Kalethra's own `workouts` and `external_workouts` (Health Connect). A manual
 * activity is never copied into either, and nothing is copied into it.
 *
 * - sport_id: stable ID from the sport catalog (src/core/activity/catalog.ts).
 * - started_at: optional start (ISO-8601 UTC); without it the activity only has its local day.
 * - distance_m, intensity, variant: only where the sport asks for them, otherwise NULL.
 * - weight_kg, met, met_ref, met_basis, calc_method: everything the calculation used, so a value
 *   stays explainable even after the catalog changes.
 * - calculated_kcal: what Kalethra calculated (NULL without a body weight).
 * - kcal: the value used everywhere; differs from calculated_kcal when kcal_overridden = 1.
 */
export const migration012ManualActivities: Migration = {
  version: 12,
  name: 'manual_activities',
  up: `
    CREATE TABLE manual_activities (
      id               TEXT PRIMARY KEY NOT NULL,
      profile_id       TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      sport_id         TEXT NOT NULL,
      local_date       TEXT NOT NULL CHECK (local_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      started_at       TEXT,
      duration_s       INTEGER NOT NULL CHECK (duration_s >= 60 AND duration_s <= 86400),
      distance_m       REAL CHECK (distance_m IS NULL OR (distance_m > 0 AND distance_m <= 1000000)),
      intensity        TEXT CHECK (intensity IS NULL OR intensity IN ('light', 'moderate', 'vigorous')),
      variant          TEXT,
      weight_kg        REAL CHECK (weight_kg IS NULL OR (weight_kg >= 20 AND weight_kg <= 400)),
      met              REAL NOT NULL CHECK (met >= 1 AND met <= 25),
      met_ref          TEXT NOT NULL,
      met_basis        TEXT NOT NULL CHECK (met_basis IN ('specific', 'general')),
      calc_method      TEXT NOT NULL,
      calculated_kcal  REAL CHECK (calculated_kcal IS NULL OR (calculated_kcal >= 0 AND calculated_kcal <= 10000)),
      kcal             REAL CHECK (kcal IS NULL OR (kcal >= 0 AND kcal <= 10000)),
      kcal_overridden  INTEGER NOT NULL DEFAULT 0 CHECK (kcal_overridden IN (0, 1)),
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );
    CREATE INDEX manual_activities_profile_date ON manual_activities (profile_id, local_date);
  `,
};
