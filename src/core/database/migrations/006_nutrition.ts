import type { Migration } from './types';

const SYNC_STATE = `sync_state TEXT NOT NULL DEFAULT 'local'
      CHECK (sync_state IN ('local', 'pending', 'synced'))`;
const UNIT = `CHECK (unit IN ('g', 'kg', 'ml', 'l', 'piece', 'serving'))`;
const NUTRIENTS = `
      energy_kcal     REAL NOT NULL CHECK (energy_kcal >= 0),
      protein_g       REAL NOT NULL CHECK (protein_g >= 0),
      carbs_g         REAL NOT NULL CHECK (carbs_g >= 0),
      fat_g           REAL NOT NULL CHECK (fat_g >= 0),
      fiber_g         REAL CHECK (fiber_g >= 0),
      sugar_g         REAL CHECK (sugar_g >= 0),
      saturated_fat_g REAL CHECK (saturated_fat_g >= 0)`;
const GOAL = (name: string) =>
  `${name}_auto REAL CHECK (${name}_auto >= 0), ${name}_manual REAL CHECK (${name}_manual >= 0)`;

/**
 * Nutrition foundation. New tables only; existing data is not touched.
 *
 * - foods (+ food_servings): custom, app-provided or copied external foods. Never deleted,
 *   only deactivated, because saved meals and recipes refer to them.
 * - meal_slots: configurable meals of a day (four defaults per profile).
 * - food_entries: eaten foods per local day with a nutrient snapshot, so corrections of a
 *   food never change past days.
 * - saved_meals (+ items): reusable templates, separate from logged days.
 * - recipes (+ ingredients): ingredients referencing foods, number of servings.
 * - nutrition_goals: dated goals, each value with automatic and manual part.
 * - water_entries: water per local day, independent of nutrients.
 */
export const migration006Nutrition: Migration = {
  version: 6,
  name: 'nutrition',
  up: `
    CREATE TABLE foods (
      id               TEXT PRIMARY KEY NOT NULL,
      profile_id       TEXT REFERENCES profiles(id) ON DELETE CASCADE,
      source           TEXT NOT NULL CHECK (source IN ('custom', 'local', 'external')),
      provider         TEXT,
      external_id      TEXT,
      name             TEXT NOT NULL,
      brand            TEXT,
      barcode          TEXT,
      reference_amount REAL NOT NULL CHECK (reference_amount > 0),
      reference_unit   TEXT NOT NULL
                       CHECK (reference_unit IN ('g', 'kg', 'ml', 'l', 'piece', 'serving')),
      ${NUTRIENTS},
      favorite         INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
      active           INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL,
      ${SYNC_STATE},
      CHECK ((source = 'local') = (profile_id IS NULL)),
      CHECK ((source = 'external') = (provider IS NOT NULL AND external_id IS NOT NULL))
    );
    CREATE INDEX foods_profile ON foods (profile_id, active, favorite);
    CREATE INDEX foods_barcode ON foods (barcode) WHERE barcode IS NOT NULL;
    -- An external product is stored at most once per profile (re-import updates it).
    CREATE UNIQUE INDEX foods_external ON foods (profile_id, provider, external_id)
      WHERE source = 'external';

    CREATE TABLE food_servings (
      food_id     TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
      unit        TEXT NOT NULL CHECK (unit IN ('piece', 'serving')),
      amount      REAL NOT NULL CHECK (amount > 0),
      amount_unit TEXT NOT NULL CHECK (amount_unit IN ('g', 'ml')),
      label       TEXT,
      PRIMARY KEY (food_id, unit)
    );

    CREATE TABLE meal_slots (
      id          TEXT PRIMARY KEY NOT NULL,
      profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      default_key TEXT CHECK (default_key IN ('breakfast', 'lunch', 'dinner', 'snacks')),
      name        TEXT,
      position    INTEGER NOT NULL,
      active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      ${SYNC_STATE},
      CHECK (default_key IS NOT NULL OR name IS NOT NULL)
    );
    CREATE INDEX meal_slots_profile ON meal_slots (profile_id, position);

    CREATE TABLE recipes (
      id           TEXT PRIMARY KEY NOT NULL,
      profile_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      description  TEXT,
      servings     REAL NOT NULL CHECK (servings > 0),
      prep_minutes INTEGER CHECK (prep_minutes >= 0),
      notes        TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      ${SYNC_STATE}
    );
    CREATE INDEX recipes_profile ON recipes (profile_id, updated_at);

    CREATE TABLE recipe_ingredients (
      id        TEXT PRIMARY KEY NOT NULL,
      recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      food_id   TEXT NOT NULL REFERENCES foods(id),
      amount    REAL NOT NULL CHECK (amount > 0),
      unit      TEXT NOT NULL ${UNIT},
      position  INTEGER NOT NULL,
      note      TEXT
    );
    CREATE INDEX recipe_ingredients_recipe ON recipe_ingredients (recipe_id, position);

    CREATE TABLE food_entries (
      id               TEXT PRIMARY KEY NOT NULL,
      profile_id       TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      local_date       TEXT NOT NULL,
      meal_id          TEXT REFERENCES meal_slots(id) ON DELETE SET NULL,
      meal_default_key TEXT,
      meal_name        TEXT,
      food_id          TEXT REFERENCES foods(id) ON DELETE SET NULL,
      recipe_id        TEXT REFERENCES recipes(id) ON DELETE SET NULL,
      name             TEXT NOT NULL,
      brand            TEXT,
      amount           REAL NOT NULL CHECK (amount > 0),
      unit             TEXT NOT NULL ${UNIT},
      eaten_at         TEXT,
      ${NUTRIENTS},
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL,
      ${SYNC_STATE}
    );
    CREATE INDEX food_entries_day ON food_entries (profile_id, local_date);
    CREATE INDEX food_entries_food ON food_entries (food_id);

    CREATE TABLE saved_meals (
      id         TEXT PRIMARY KEY NOT NULL,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      meal_id    TEXT REFERENCES meal_slots(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      ${SYNC_STATE}
    );
    CREATE INDEX saved_meals_profile ON saved_meals (profile_id, name);

    CREATE TABLE saved_meal_items (
      id            TEXT PRIMARY KEY NOT NULL,
      saved_meal_id TEXT NOT NULL REFERENCES saved_meals(id) ON DELETE CASCADE,
      food_id       TEXT NOT NULL REFERENCES foods(id),
      amount        REAL NOT NULL CHECK (amount > 0),
      unit          TEXT NOT NULL ${UNIT},
      position      INTEGER NOT NULL
    );
    CREATE INDEX saved_meal_items_meal ON saved_meal_items (saved_meal_id, position);

    CREATE TABLE nutrition_goals (
      id             TEXT PRIMARY KEY NOT NULL,
      profile_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      effective_from TEXT NOT NULL,
      goal_type      TEXT NOT NULL CHECK (goal_type IN ('lose', 'maintain', 'gain')),
      ${GOAL('energy_kcal')},
      ${GOAL('protein_g')},
      ${GOAL('carbs_g')},
      ${GOAL('fat_g')},
      ${GOAL('water_ml')},
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL,
      ${SYNC_STATE}
    );
    CREATE UNIQUE INDEX nutrition_goals_day ON nutrition_goals (profile_id, effective_from);

    CREATE TABLE water_entries (
      id         TEXT PRIMARY KEY NOT NULL,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      local_date TEXT NOT NULL,
      amount     REAL NOT NULL CHECK (amount > 0),
      unit       TEXT NOT NULL CHECK (unit IN ('ml', 'l')),
      drank_at   TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      ${SYNC_STATE}
    );
    CREATE INDEX water_entries_day ON water_entries (profile_id, local_date);
  `,
};
