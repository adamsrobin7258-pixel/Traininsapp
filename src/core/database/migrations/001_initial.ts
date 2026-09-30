import type { Migration } from './types';

/**
 * Initial schema: app settings and the local profile.
 * Conventions for all user-owned tables are documented in DATABASE.md.
 */
export const migration001Initial: Migration = {
  version: 1,
  name: 'initial',
  up: `
    CREATE TABLE app_settings (
      key        TEXT PRIMARY KEY NOT NULL,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE profiles (
      id           TEXT PRIMARY KEY NOT NULL,
      display_name TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      deleted_at   TEXT,
      sync_state   TEXT NOT NULL DEFAULT 'local'
                   CHECK (sync_state IN ('local', 'pending', 'synced'))
    );
  `,
};
