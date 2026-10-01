import type { Migration } from './types';

/**
 * Data imported from the device's health store (Health Connect; later Apple Health).
 *
 * Purely additive. Imported values live apart from Kalethra's own data: `weight_entries` (and
 * with it the nutrition goals, which follow that table) never changes through an import.
 *
 * - imported_weights: one value per profile, platform and local day – the day's earliest
 *   measurement. `external_id` is that record's ID in the platform, `measured_at` its time.
 * - daily_activity: one row per profile, platform and local day with the platform's
 *   aggregated totals (steps, active energy in kcal); a column is NULL without data.
 *
 * `platform` is the source ('healthConnect'), `source` the recording app or device as reported.
 * Rows of the last 30 days are reconciled with the platform on every successful sync.
 */
export const migration010HealthImport: Migration = {
  version: 10,
  name: 'health_import',
  up: `
    CREATE TABLE imported_weights (
      id           TEXT PRIMARY KEY NOT NULL,
      profile_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      platform     TEXT NOT NULL CHECK (platform IN ('healthConnect')),
      date         TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      value        REAL NOT NULL CHECK (value >= 20 AND value <= 400),
      unit         TEXT NOT NULL DEFAULT 'kg' CHECK (unit = 'kg'),
      measured_at  TEXT NOT NULL,
      external_id  TEXT,
      source       TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
    CREATE UNIQUE INDEX imported_weights_day ON imported_weights (profile_id, platform, date);
    CREATE INDEX imported_weights_profile_date ON imported_weights (profile_id, date);
    CREATE INDEX imported_weights_platform ON imported_weights (platform);

    CREATE TABLE daily_activity (
      profile_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      platform     TEXT NOT NULL CHECK (platform IN ('healthConnect')),
      date         TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      steps        INTEGER CHECK (steps IS NULL OR (steps >= 0 AND steps <= 200000)),
      active_kcal  REAL CHECK (active_kcal IS NULL OR (active_kcal >= 0 AND active_kcal <= 20000)),
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      PRIMARY KEY (profile_id, platform, date)
    );
    CREATE INDEX daily_activity_profile_date ON daily_activity (profile_id, date);
    CREATE INDEX daily_activity_platform ON daily_activity (platform);
  `,
};
