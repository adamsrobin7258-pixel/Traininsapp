import type { Migration } from './types';

/**
 * Body weight, one primary value per profile and local calendar day. Stored in kilograms.
 * Deletions are physical until cloud sync exists (see DATABASE.md, "weight_entries").
 */
export const migration003WeightEntries: Migration = {
  version: 3,
  name: 'weight_entries',
  up: `
    CREATE TABLE weight_entries (
      id          TEXT PRIMARY KEY NOT NULL,
      profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      date        TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      value       REAL NOT NULL CHECK (value >= 20 AND value <= 400),
      unit        TEXT NOT NULL DEFAULT 'kg' CHECK (unit = 'kg'),
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      sync_state  TEXT NOT NULL DEFAULT 'local'
                  CHECK (sync_state IN ('local', 'pending', 'synced'))
    );

    -- One entry per profile and day; also serves "by date", history and range queries.
    CREATE UNIQUE INDEX weight_entries_profile_date ON weight_entries (profile_id, date);
  `,
};
