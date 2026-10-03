import type { SqlExecutor } from '@/core/database';
import { DEFAULT_MEAL_KEYS, type DefaultMealKey, type MealSlot } from './meals';
import { bool } from './rows';
import type { SavedMeal, SavedMealItem } from './savedMeal';
import { isQuantityUnit } from './units';

interface SlotRow {
  id: string;
  profile_id: string;
  default_key: string | null;
  name: string | null;
  position: number;
  active: number;
}

interface SavedMealRow {
  id: string;
  profile_id: string;
  name: string;
  meal_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: string;
  saved_meal_id: string;
  food_id: string;
  amount: number;
  unit: string;
  position: number;
}

const toSlot = (row: SlotRow): MealSlot => ({
  id: row.id,
  profileId: row.profile_id,
  defaultKey: (DEFAULT_MEAL_KEYS as readonly string[]).includes(row.default_key ?? '')
    ? (row.default_key as DefaultMealKey)
    : null,
  name: row.name,
  position: row.position,
  active: bool(row.active),
});

const toItem = (row: ItemRow): SavedMealItem => ({
  id: row.id,
  foodId: row.food_id,
  amount: row.amount,
  unit: isQuantityUnit(row.unit) ? row.unit : 'g',
  position: row.position,
});

/** SQL for meal configuration and saved meal templates. */
export class MealRepository {
  constructor(private readonly db: SqlExecutor) {}

  // ── Meal slots ─────────────────────────────────────────────────────────────

  async listSlots(profileId: string): Promise<MealSlot[]> {
    const rows = await this.db.query<SlotRow>(
      'SELECT * FROM meal_slots WHERE profile_id = ? ORDER BY position',
      [profileId],
    );
    return rows.map(toSlot);
  }

  async findSlot(profileId: string, id: string): Promise<MealSlot | null> {
    const rows = await this.db.query<SlotRow>(
      'SELECT * FROM meal_slots WHERE id = ? AND profile_id = ?',
      [id, profileId],
    );
    const row = rows[0];
    return row ? toSlot(row) : null;
  }

  async insertSlot(slot: MealSlot, now: string): Promise<void> {
    await this.db.run(
      `INSERT INTO meal_slots (id, profile_id, default_key, name, position, active,
         created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slot.id,
        slot.profileId,
        slot.defaultKey,
        slot.name,
        slot.position,
        slot.active ? 1 : 0,
        now,
        now,
      ],
    );
  }

  async renameSlot(id: string, name: string, now: string) {
    await this.db.run('UPDATE meal_slots SET name = ?, updated_at = ? WHERE id = ?', [
      name,
      now,
      id,
    ]);
  }

  async setSlotActive(id: string, active: boolean, now: string) {
    await this.db.run('UPDATE meal_slots SET active = ?, updated_at = ? WHERE id = ?', [
      active ? 1 : 0,
      now,
      id,
    ]);
  }

  async setSlotPositions(orderedIds: readonly string[], now: string) {
    for (const [position, id] of orderedIds.entries()) {
      await this.db.run('UPDATE meal_slots SET position = ?, updated_at = ? WHERE id = ?', [
        position,
        now,
        id,
      ]);
    }
  }

  // ── Saved meals ────────────────────────────────────────────────────────────

  private async withItems(rows: SavedMealRow[]): Promise<SavedMeal[]> {
    if (rows.length === 0) return [];
    const items = await this.db.query<ItemRow>(
      `SELECT * FROM saved_meal_items WHERE saved_meal_id IN (${rows.map(() => '?').join(', ')})
       ORDER BY position`,
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      name: row.name,
      mealId: row.meal_id,
      items: items.filter((item) => item.saved_meal_id === row.id).map(toItem),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async listSavedMeals(profileId: string): Promise<SavedMeal[]> {
    const rows = await this.db.query<SavedMealRow>(
      'SELECT * FROM saved_meals WHERE profile_id = ? ORDER BY name COLLATE NOCASE',
      [profileId],
    );
    return this.withItems(rows);
  }

  async findSavedMeal(profileId: string, id: string): Promise<SavedMeal | null> {
    const rows = await this.db.query<SavedMealRow>(
      'SELECT * FROM saved_meals WHERE id = ? AND profile_id = ?',
      [id, profileId],
    );
    return (await this.withItems(rows))[0] ?? null;
  }

  async insertSavedMeal(meal: SavedMeal): Promise<void> {
    await this.db.run(
      `INSERT INTO saved_meals (id, profile_id, name, meal_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [meal.id, meal.profileId, meal.name, meal.mealId, meal.createdAt, meal.updatedAt],
    );
    await this.replaceItems(meal.id, meal.items);
  }

  async updateSavedMeal(meal: SavedMeal): Promise<void> {
    await this.db.run('UPDATE saved_meals SET name = ?, meal_id = ?, updated_at = ? WHERE id = ?', [
      meal.name,
      meal.mealId,
      meal.updatedAt,
      meal.id,
    ]);
    await this.replaceItems(meal.id, meal.items);
  }

  async deleteSavedMeal(profileId: string, id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM saved_meals WHERE id = ? AND profile_id = ?', [
      id,
      profileId,
    ]);
    // > 0, not === 1: the native plugin also counts rows removed or cleared by foreign keys.
    return result.changes > 0;
  }

  private async replaceItems(savedMealId: string, items: readonly SavedMealItem[]) {
    await this.db.run('DELETE FROM saved_meal_items WHERE saved_meal_id = ?', [savedMealId]);
    for (const item of items) {
      await this.db.run(
        `INSERT INTO saved_meal_items (id, saved_meal_id, food_id, amount, unit, position)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [item.id, savedMealId, item.foodId, item.amount, item.unit, item.position],
      );
    }
  }
}
