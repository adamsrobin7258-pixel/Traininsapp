import type { Migration } from './types';

/** Technical key/value store for the storage self-test (see core/database/selfTest.ts). */
export const migration002Diagnostics: Migration = {
  version: 2,
  name: 'diagnostics',
  up: `
    CREATE TABLE diagnostics (
      key        TEXT PRIMARY KEY NOT NULL,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `,
};
