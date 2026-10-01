import type { Migration } from './types';

/**
 * Provenance of reference foods and of user copies.
 *
 * Purely additive – no existing row changes:
 * - origin_dataset / origin_code / origin_version: a food shipped with the app (source 'local',
 *   no profile) taken from a reference dataset, e.g. 'bls' / BLS code / '4.0'. Such a row is
 *   created the first time the food is used and is never edited by the user.
 * - copied_from_food_id: a user's own food created as an editable copy of another food (e.g. a
 *   BLS food); the reference itself stays unchanged.
 */
export const migration008FoodOrigin: Migration = {
  version: 8,
  name: 'food_origin',
  up: `
    ALTER TABLE foods ADD COLUMN origin_dataset TEXT;
    ALTER TABLE foods ADD COLUMN origin_code TEXT;
    ALTER TABLE foods ADD COLUMN origin_version TEXT;
    ALTER TABLE foods ADD COLUMN copied_from_food_id TEXT REFERENCES foods(id) ON DELETE SET NULL;
    CREATE UNIQUE INDEX foods_origin ON foods (origin_dataset, origin_code)
      WHERE origin_dataset IS NOT NULL;
  `,
};
