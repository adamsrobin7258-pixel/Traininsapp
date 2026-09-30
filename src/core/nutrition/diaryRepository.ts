import type { SqlExecutor } from '@/core/database';
import type { FoodEntry } from './diary';
import { DEFAULT_MEAL_KEYS, type DefaultMealKey } from './meals';
import { NUTRIENT_COLUMNS, nutrientParams, toNutrients, type NutrientRow } from './rows';
import { isQuantityUnit } from './units';
import type { WaterEntry, WaterUnit } from './water';

interface EntryRow extends NutrientRow {
  id: string;
  profile_id: string;
  local_date: string;
  meal_id: string | null;
  meal_default_key: string | null;
  meal_name: string | null;
  food_id: string | null;
  recipe_id: string | null;
  name: string;
  brand: string | null;
  amount: number;
  unit: string;
  eaten_at: string | null;
  created_at: string;
  updated_at: string;
}

interface WaterRow {
  id: string;
  profile_id: string;
  local_date: string;
  amount: number;
  unit: WaterUnit;
  drank_at: string | null;
  created_at: string;
  updated_at: string;
}

const toEntry = (row: EntryRow): FoodEntry => ({
  id: row.id,
  profileId: row.profile_id,
  localDate: row.local_date,
  mealId: row.meal_id,
  mealDefaultKey: (DEFAULT_MEAL_KEYS as readonly string[]).includes(row.meal_default_key ?? '')
    ? (row.meal_default_key as DefaultMealKey)
    : null,
  mealName: row.meal_name,
  foodId: row.food_id,
  recipeId: row.recipe_id,
  name: row.name,
  brand: row.brand,
  amount: row.amount,
  unit: isQuantityUnit(row.unit) ? row.unit : 'g',
  eatenAt: row.eaten_at,
  nutrients: toNutrients(row),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toWater = (row: WaterRow): WaterEntry => ({
  id: row.id,
  profileId: row.profile_id,
  localDate: row.local_date,
  amount: row.amount,
  unit: row.unit,
  drankAt: row.drank_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** SQL for the food diary and water entries, always scoped to one profile. */
export class DiaryRepository {
  constructor(private readonly db: SqlExecutor) {}

  async listEntries(profileId: string, fromDate: string, toDate: string): Promise<FoodEntry[]> {
    const rows = await this.db.query<EntryRow>(
      `SELECT * FROM food_entries WHERE profile_id = ? AND local_date BETWEEN ? AND ?
       ORDER BY local_date, COALESCE(eaten_at, created_at), created_at`,
      [profileId, fromDate, toDate],
    );
    return rows.map(toEntry);
  }

  async findEntry(profileId: string, id: string): Promise<FoodEntry | null> {
    const rows = await this.db.query<EntryRow>(
      'SELECT * FROM food_entries WHERE id = ? AND profile_id = ?',
      [id, profileId],
    );
    const row = rows[0];
    return row ? toEntry(row) : null;
  }

  async insertEntry(entry: FoodEntry): Promise<void> {
    await this.db.run(
      `INSERT INTO food_entries (id, profile_id, local_date, meal_id, meal_default_key, meal_name,
         food_id, recipe_id, name, brand, amount, unit, eaten_at, ${NUTRIENT_COLUMNS},
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.profileId,
        entry.localDate,
        entry.mealId,
        entry.mealDefaultKey,
        entry.mealName,
        entry.foodId,
        entry.recipeId,
        entry.name,
        entry.brand,
        entry.amount,
        entry.unit,
        entry.eatenAt,
        ...nutrientParams(entry.nutrients),
        entry.createdAt,
        entry.updatedAt,
      ],
    );
  }

  /** Stores a changed quantity with its rescaled snapshot (never re-read from the food). */
  async updateEntryQuantity(entry: FoodEntry): Promise<void> {
    await this.db.run(
      `UPDATE food_entries SET amount = ?, unit = ?, energy_kcal = ?, protein_g = ?, carbs_g = ?,
         fat_g = ?, fiber_g = ?, sugar_g = ?, saturated_fat_g = ?, updated_at = ?,
         sync_state = CASE sync_state WHEN 'synced' THEN 'pending' ELSE sync_state END
       WHERE id = ?`,
      [entry.amount, entry.unit, ...nutrientParams(entry.nutrients), entry.updatedAt, entry.id],
    );
  }

  async moveEntry(entry: FoodEntry): Promise<void> {
    await this.db.run(
      `UPDATE food_entries SET local_date = ?, meal_id = ?, meal_default_key = ?, meal_name = ?,
         updated_at = ? WHERE id = ?`,
      [
        entry.localDate,
        entry.mealId,
        entry.mealDefaultKey,
        entry.mealName,
        entry.updatedAt,
        entry.id,
      ],
    );
  }

  async deleteEntry(profileId: string, id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM food_entries WHERE id = ? AND profile_id = ?', [
      id,
      profileId,
    ]);
    return result.changes === 1;
  }

  async listWater(profileId: string, fromDate: string, toDate: string): Promise<WaterEntry[]> {
    const rows = await this.db.query<WaterRow>(
      `SELECT * FROM water_entries WHERE profile_id = ? AND local_date BETWEEN ? AND ?
       ORDER BY local_date, COALESCE(drank_at, created_at)`,
      [profileId, fromDate, toDate],
    );
    return rows.map(toWater);
  }

  async insertWater(entry: WaterEntry): Promise<void> {
    await this.db.run(
      `INSERT INTO water_entries (id, profile_id, local_date, amount, unit, drank_at,
         created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.profileId,
        entry.localDate,
        entry.amount,
        entry.unit,
        entry.drankAt,
        entry.createdAt,
        entry.updatedAt,
      ],
    );
  }

  async deleteWater(profileId: string, id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM water_entries WHERE id = ? AND profile_id = ?', [
      id,
      profileId,
    ]);
    return result.changes === 1;
  }
}
