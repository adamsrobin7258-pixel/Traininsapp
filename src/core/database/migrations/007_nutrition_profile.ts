import type { Migration } from './types';

/**
 * Adaptive nutrition profile.
 *
 * Purely additive – existing goals keep every value:
 * - profiles: sex, birth date and height for the energy calculation (the age is derived, the
 *   weight stays in weight_entries – it is never copied).
 * - nutrition_goals rows become versions of the nutrition profile, valid from `effective_from`
 *   until the next version starts. New columns hold the user's choices and a snapshot of the
 *   calculation (inputs, intermediate values, results) so every past goal stays explainable.
 *   Existing rows read as manual goals (`auto_enabled = 0`, no calculation), exactly as before.
 */
export const migration007NutritionProfile: Migration = {
  version: 7,
  name: 'nutrition_profile',
  up: `
    ALTER TABLE profiles ADD COLUMN sex TEXT
      CHECK (sex IN ('male', 'female', 'unspecified'));
    ALTER TABLE profiles ADD COLUMN birth_date TEXT;
    ALTER TABLE profiles ADD COLUMN height_cm REAL CHECK (height_cm > 0);

    ALTER TABLE nutrition_goals ADD COLUMN goal_level TEXT
      CHECK (goal_level IN ('slow', 'moderate', 'fast', 'higher'));
    ALTER TABLE nutrition_goals ADD COLUMN activity_level TEXT
      CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'veryActive'));
    ALTER TABLE nutrition_goals ADD COLUMN include_training INTEGER NOT NULL DEFAULT 0
      CHECK (include_training IN (0, 1));
    ALTER TABLE nutrition_goals ADD COLUMN target_weight_kg REAL CHECK (target_weight_kg > 0);
    ALTER TABLE nutrition_goals ADD COLUMN auto_enabled INTEGER NOT NULL DEFAULT 0
      CHECK (auto_enabled IN (0, 1));
    ALTER TABLE nutrition_goals ADD COLUMN calculation TEXT;
  `,
};
