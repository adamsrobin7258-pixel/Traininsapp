import type { Migration } from './types';

/**
 * Phase 10 – versioned personal targets.
 *
 * goal_targets holds one version per profile, kind and first day (`effective_from`), like
 * nutrition_goals: a change starts a new version, older versions are never changed, so a past
 * period keeps the target that applied then.
 *
 * Kinds: trainingsPerWeek, activeMinutesPerWeek (until now unversioned in app_settings) and
 * stepsPerDay (new). `value` NULL = no target from that day on.
 *
 * Takeover: the two existing settings applied to every day so far, so they become versions from
 * 1970-01-01 – every existing score period is judged exactly as before. Only valid whole numbers
 * in range are taken over (the app never stored anything else); `null` or missing values need no
 * row. Afterwards the two keys are removed from app_settings, so there is one source only.
 * Re-running is harmless: INSERT OR IGNORE on the unique key.
 */
export const migration014GoalTargets: Migration = {
  version: 14,
  name: 'goal_targets',
  up: `
    CREATE TABLE goal_targets (
      id             TEXT PRIMARY KEY NOT NULL,
      profile_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      kind           TEXT NOT NULL
        CHECK (kind IN ('trainingsPerWeek', 'activeMinutesPerWeek', 'stepsPerDay')),
      effective_from TEXT NOT NULL
        CHECK (effective_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      value          INTEGER CHECK (
        value IS NULL
        OR (kind = 'trainingsPerWeek' AND value BETWEEN 1 AND 14)
        OR (kind = 'activeMinutesPerWeek' AND value BETWEEN 10 AND 2000)
        OR (kind = 'stepsPerDay' AND value BETWEEN 1000 AND 50000)
      ),
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );
    CREATE UNIQUE INDEX goal_targets_version ON goal_targets (profile_id, kind, effective_from);

    INSERT OR IGNORE INTO goal_targets (id, profile_id, kind, effective_from, value, created_at,
      updated_at)
    SELECT 'migrated-' || s.key || '-' || p.id, p.id, s.key, '1970-01-01',
      CAST(s.value AS INTEGER), s.updated_at, s.updated_at
    FROM app_settings s CROSS JOIN profiles p
    WHERE s.key IN ('trainingsPerWeek', 'activeMinutesPerWeek')
      AND s.value NOT GLOB '*[^0-9]*' AND s.value <> ''
      AND (
        (s.key = 'trainingsPerWeek' AND CAST(s.value AS INTEGER) BETWEEN 1 AND 14)
        OR (s.key = 'activeMinutesPerWeek' AND CAST(s.value AS INTEGER) BETWEEN 10 AND 2000)
      );

    DELETE FROM app_settings WHERE key IN ('trainingsPerWeek', 'activeMinutesPerWeek');
  `,
};
