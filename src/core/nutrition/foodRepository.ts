import type { SqlExecutor } from '@/core/database';
import type { Food, FoodServing, FoodSource } from './food';
import { bool, NUTRIENT_COLUMNS, nutrientParams, toNutrients, type NutrientRow } from './rows';
import { isQuantityUnit, type CountUnit, type MeasureUnit } from './units';

interface FoodRow extends NutrientRow {
  id: string;
  profile_id: string | null;
  source: FoodSource;
  provider: string | null;
  external_id: string | null;
  name: string;
  brand: string | null;
  barcode: string | null;
  reference_amount: number;
  reference_unit: string;
  favorite: number;
  active: number;
  created_at: string;
  updated_at: string;
}

interface ServingRow {
  food_id: string;
  unit: CountUnit;
  amount: number;
  amount_unit: MeasureUnit;
  label: string | null;
}

const toFood = (row: FoodRow, servings: FoodServing[]): Food => ({
  id: row.id,
  profileId: row.profile_id,
  source: row.source,
  provider: row.provider,
  externalId: row.external_id,
  name: row.name,
  brand: row.brand,
  barcode: row.barcode,
  reference: {
    amount: row.reference_amount,
    unit: isQuantityUnit(row.reference_unit) ? row.reference_unit : 'g',
  },
  nutrients: toNutrients(row),
  servings,
  favorite: bool(row.favorite),
  active: bool(row.active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** SQL for foods and their serving sizes. Profile-scoped reads include app-provided foods. */
export class FoodRepository {
  constructor(private readonly db: SqlExecutor) {}

  private async withServings(rows: FoodRow[]): Promise<Food[]> {
    if (rows.length === 0) return [];
    const servings = await this.db.query<ServingRow>(
      `SELECT * FROM food_servings WHERE food_id IN (${rows.map(() => '?').join(', ')})
       ORDER BY unit`,
      rows.map((row) => row.id),
    );
    return rows.map((row) =>
      toFood(
        row,
        servings
          .filter((s) => s.food_id === row.id)
          .map((s) => ({
            unit: s.unit,
            amount: s.amount,
            amountUnit: s.amount_unit,
            label: s.label,
          })),
      ),
    );
  }

  async findById(profileId: string, id: string): Promise<Food | null> {
    const rows = await this.db.query<FoodRow>(
      'SELECT * FROM foods WHERE id = ? AND (profile_id = ? OR profile_id IS NULL)',
      [id, profileId],
    );
    return (await this.withServings(rows))[0] ?? null;
  }

  async findManyById(profileId: string, ids: readonly string[]): Promise<Food[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.query<FoodRow>(
      `SELECT * FROM foods WHERE (profile_id = ? OR profile_id IS NULL)
       AND id IN (${ids.map(() => '?').join(', ')})`,
      [profileId, ...ids],
    );
    return this.withServings(rows);
  }

  async list(
    profileId: string,
    { includeInactive = false, favoritesOnly = false } = {},
  ): Promise<Food[]> {
    const rows = await this.db.query<FoodRow>(
      `SELECT * FROM foods WHERE (profile_id = ? OR profile_id IS NULL)
       AND (? = 1 OR active = 1) AND (? = 0 OR favorite = 1)
       ORDER BY name COLLATE NOCASE`,
      [profileId, includeInactive ? 1 : 0, favoritesOnly ? 1 : 0],
    );
    return this.withServings(rows);
  }

  async findByBarcode(profileId: string, barcode: string): Promise<Food[]> {
    const rows = await this.db.query<FoodRow>(
      `SELECT * FROM foods WHERE barcode = ? AND (profile_id = ? OR profile_id IS NULL)
       ORDER BY active DESC, updated_at DESC`,
      [barcode, profileId],
    );
    return this.withServings(rows);
  }

  async findExternal(profileId: string, provider: string, externalId: string) {
    const rows = await this.db.query<FoodRow>(
      `SELECT * FROM foods WHERE profile_id = ? AND source = 'external'
       AND provider = ? AND external_id = ?`,
      [profileId, provider, externalId],
    );
    return (await this.withServings(rows))[0] ?? null;
  }

  async insert(food: Food): Promise<void> {
    await this.db.run(
      `INSERT INTO foods (id, profile_id, source, provider, external_id, name, brand, barcode,
         reference_amount, reference_unit, ${NUTRIENT_COLUMNS}, favorite, active,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        food.id,
        food.profileId,
        food.source,
        food.provider,
        food.externalId,
        food.name,
        food.brand,
        food.barcode,
        food.reference.amount,
        food.reference.unit,
        ...nutrientParams(food.nutrients),
        food.favorite ? 1 : 0,
        food.active ? 1 : 0,
        food.createdAt,
        food.updatedAt,
      ],
    );
    await this.replaceServings(food.id, food.servings);
  }

  /** Updates the describing data (not source, owner or flags). */
  async update(food: Food): Promise<void> {
    await this.db.run(
      `UPDATE foods SET name = ?, brand = ?, barcode = ?, reference_amount = ?,
         reference_unit = ?, energy_kcal = ?, protein_g = ?, carbs_g = ?, fat_g = ?,
         fiber_g = ?, sugar_g = ?, saturated_fat_g = ?, updated_at = ?,
         sync_state = CASE sync_state WHEN 'synced' THEN 'pending' ELSE sync_state END
       WHERE id = ?`,
      [
        food.name,
        food.brand,
        food.barcode,
        food.reference.amount,
        food.reference.unit,
        ...nutrientParams(food.nutrients),
        food.updatedAt,
        food.id,
      ],
    );
    await this.replaceServings(food.id, food.servings);
  }

  async setFlag(id: string, flag: 'favorite' | 'active', value: boolean, now: string) {
    await this.db.run(`UPDATE foods SET ${flag} = ?, updated_at = ? WHERE id = ?`, [
      value ? 1 : 0,
      now,
      id,
    ]);
  }

  /**
   * Active foods by their latest use in the diary (newest first). "Use" is logging the food –
   * directly or through a saved meal – so a food moves up again every time it is eaten.
   */
  async listRecent(profileId: string, limit: number): Promise<Food[]> {
    const rows = await this.db.query<FoodRow & { last_used: string }>(
      `SELECT f.*, u.last_used FROM foods f
       JOIN (SELECT food_id, MAX(created_at) AS last_used FROM food_entries
             WHERE profile_id = ? AND food_id IS NOT NULL GROUP BY food_id) u ON u.food_id = f.id
       WHERE f.active = 1 AND (f.profile_id = ? OR f.profile_id IS NULL)
       ORDER BY u.last_used DESC, f.name COLLATE NOCASE
       LIMIT ?`,
      [profileId, profileId, limit],
    );
    return this.withServings(rows);
  }

  /** True when a diary entry, saved meal or recipe refers to the food. */
  async isReferenced(id: string): Promise<boolean> {
    const rows = await this.db.query<{ used: number }>(
      `SELECT EXISTS (SELECT 1 FROM food_entries WHERE food_id = ?)
         OR EXISTS (SELECT 1 FROM saved_meal_items WHERE food_id = ?)
         OR EXISTS (SELECT 1 FROM recipe_ingredients WHERE food_id = ?) AS used`,
      [id, id, id],
    );
    return (rows[0]?.used ?? 0) === 1;
  }

  /** Removes an unused food (its serving sizes go with it). */
  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM foods WHERE id = ?', [id]);
  }

  private async replaceServings(foodId: string, servings: readonly FoodServing[]) {
    await this.db.run('DELETE FROM food_servings WHERE food_id = ?', [foodId]);
    for (const serving of servings) {
      await this.db.run(
        'INSERT INTO food_servings (food_id, unit, amount, amount_unit, label) VALUES (?, ?, ?, ?, ?)',
        [foodId, serving.unit, serving.amount, serving.amountUnit, serving.label],
      );
    }
  }
}
