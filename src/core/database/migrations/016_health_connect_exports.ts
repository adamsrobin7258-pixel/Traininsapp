import type { Migration } from './types';

/**
 * Optional export of Kalethra's own workouts and activities to Health Connect (Settings → App →
 * Health Connect, off by default). One row per exported Kalethra record – the bookkeeping that
 * makes the export idempotent: what was written, in which version, and what is still to do.
 * Purely additive: `workouts` and `manual_activities` stay unchanged.
 *
 * - source_kind / source_id: the Kalethra record (`workouts.id` or `manual_activities.id`).
 *   No foreign key – two source tables; a row of a deleted record is simply removed on its
 *   next retry. Deleting in Kalethra never deletes anything in Health Connect.
 * - client_record_id: the stable ID written to Health Connect ("kalethra:workout:<id>"). Health
 *   Connect treats a second write with it as an update – never a second session.
 * - exported_version: the record's `updated_at` (epoch ms) of the last successful write; an edit
 *   later than that is written again.
 * - status: pending (to write), exported, failed (retried later), skipped (never written: no
 *   matching Health Connect type, no start time, or refused as invalid).
 * - last_error: a code only – never data of the workout.
 */
export const migration016HealthConnectExports: Migration = {
  version: 16,
  name: 'health_connect_exports',
  up: `
    CREATE TABLE health_connect_exports (
      id               TEXT PRIMARY KEY NOT NULL,
      profile_id       TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      source_kind      TEXT NOT NULL CHECK (source_kind IN ('workout', 'activity')),
      source_id        TEXT NOT NULL,
      client_record_id TEXT NOT NULL,
      status           TEXT NOT NULL
        CHECK (status IN ('pending', 'exported', 'failed', 'skipped')),
      exported_version INTEGER,
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
    CREATE UNIQUE INDEX health_connect_exports_source
      ON health_connect_exports (profile_id, source_kind, source_id);
    CREATE INDEX health_connect_exports_status ON health_connect_exports (profile_id, status);
  `,
};
