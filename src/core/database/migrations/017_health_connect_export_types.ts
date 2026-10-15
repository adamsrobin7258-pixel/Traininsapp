import type { Migration } from './types';

/**
 * Health Connect export, second step: besides the session, a Kalethra record can now become an
 * active-calories and a distance record – each with its own client record ID and its own
 * bookkeeping row, so a failure or a missing permission of one type never blocks the others.
 *
 * - record_type: session | calories | distance. Existing rows are sessions (their client record
 *   ID stays "kalethra:<kind>:<id>" – sessions already written are updated, never duplicated).
 * - exported_value: the amount last written (kcal or metres; NULL for sessions). A changed value
 *   is written again even when the Kalethra record itself did not change (e.g. a backdated
 *   body weight changes the kcal of a workout).
 * - status `removed`: an amount Kalethra had written was removed or became invalid, and
 *   Kalethra deleted its own record in Health Connect (by client record ID – never anything
 *   else).
 *
 * SQLite cannot change a CHECK constraint or a unique index's columns in place, so the table is
 * rebuilt with every row copied unchanged; nothing references it.
 */
export const migration017HealthConnectExportTypes: Migration = {
  version: 17,
  name: 'health_connect_export_types',
  up: `
    CREATE TABLE health_connect_exports_v17 (
      id               TEXT PRIMARY KEY NOT NULL,
      profile_id       TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      source_kind      TEXT NOT NULL CHECK (source_kind IN ('workout', 'activity')),
      source_id        TEXT NOT NULL,
      record_type      TEXT NOT NULL DEFAULT 'session'
        CHECK (record_type IN ('session', 'calories', 'distance')),
      client_record_id TEXT NOT NULL,
      status           TEXT NOT NULL
        CHECK (status IN ('pending', 'exported', 'failed', 'skipped', 'removed')),
      exported_version INTEGER,
      exported_value   REAL CHECK (exported_value IS NULL OR exported_value > 0),
      attempts         INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      last_error       TEXT CHECK (
        last_error IS NULL OR last_error IN (
          'unavailable', 'permission', 'invalid', 'failed', 'unsupported-type', 'no-start-time'
        )
      ),
      last_attempt_at  TEXT,
      last_success_at  TEXT,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );
    INSERT INTO health_connect_exports_v17 (id, profile_id, source_kind, source_id, record_type,
      client_record_id, status, exported_version, exported_value, attempts, last_error,
      last_attempt_at, last_success_at, created_at, updated_at)
    SELECT id, profile_id, source_kind, source_id, 'session', client_record_id, status,
      exported_version, NULL, attempts, last_error, last_attempt_at, last_success_at, created_at,
      updated_at
    FROM health_connect_exports;
    DROP TABLE health_connect_exports;
    ALTER TABLE health_connect_exports_v17 RENAME TO health_connect_exports;
    CREATE UNIQUE INDEX health_connect_exports_source
      ON health_connect_exports (profile_id, source_kind, source_id, record_type);
    CREATE INDEX health_connect_exports_status ON health_connect_exports (profile_id, status);
  `,
};
