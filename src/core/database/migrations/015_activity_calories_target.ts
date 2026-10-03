import type { Migration } from './types';

/**
 * Phase 12 – "Aktivitätskalorien anrechnen" becomes a versioned setting.
 *
 * Until now the switch was one unversioned value in app_settings, and turning it on or off
 * changed the calorie goal of every past day as well (diary, progress and the nutrition part of
 * the score). Like the other targets it now lives in goal_targets as kind `activityCalories`
 * (1 = on, 0 = off): a change applies from the day it is made, past days keep the setting that
 * applied then.
 *
 * SQLite cannot change a CHECK constraint, so goal_targets is rebuilt with the same columns and
 * every row copied unchanged; nothing references goal_targets.
 *
 * Takeover: the switch so far applied to every day, so an "on" becomes a version from
 * 1970-01-01 for every profile – every past day shows the same goal as before the update. "Off"
 * is the default and needs no row. Afterwards the key is removed from app_settings, so there is
 * one source only. Re-running is harmless: INSERT OR IGNORE on the unique key.
 */
export const migration015ActivityCaloriesTarget: Migration = {
  version: 15,
  name: 'activity_calories_target',
  up: `
    CREATE TABLE goal_targets_v15 (
      id             TEXT PRIMARY KEY NOT NULL,
      profile_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      kind           TEXT NOT NULL CHECK (
        kind IN ('trainingsPerWeek', 'activeMinutesPerWeek', 'stepsPerDay', 'activityCalories')
      ),
      effective_from TEXT NOT NULL
        CHECK (effective_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      value          INTEGER CHECK (
        value IS NULL
        OR (kind = 'trainingsPerWeek' AND value BETWEEN 1 AND 14)
        OR (kind = 'activeMinutesPerWeek' AND value BETWEEN 10 AND 2000)
        OR (kind = 'stepsPerDay' AND value BETWEEN 1000 AND 50000)
        OR (kind = 'activityCalories' AND value IN (0, 1))
      ),
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );
    INSERT INTO goal_targets_v15 (id, profile_id, kind, effective_from, value, created_at,
      updated_at)
    SELECT id, profile_id, kind, effective_from, value, created_at, updated_at FROM goal_targets;
    DROP TABLE goal_targets;
    ALTER TABLE goal_targets_v15 RENAME TO goal_targets;
    CREATE UNIQUE INDEX goal_targets_version ON goal_targets (profile_id, kind, effective_from);

    INSERT OR IGNORE INTO goal_targets (id, profile_id, kind, effective_from, value, created_at,
      updated_at)
    SELECT 'migrated-activityCalories-' || p.id, p.id, 'activityCalories', '1970-01-01', 1,
      s.updated_at, s.updated_at
    FROM app_settings s CROSS JOIN profiles p
    WHERE s.key = 'countActivityCalories' AND s.value = 'true';

    DELETE FROM app_settings WHERE key = 'countActivityCalories';
  `,
};
