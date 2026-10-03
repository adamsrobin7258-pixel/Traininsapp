import type { SqlExecutor } from '@/core/database';
import type { Recipe, RecipeIngredient } from './recipe';
import { isQuantityUnit } from './units';

interface RecipeRow {
  id: string;
  profile_id: string;
  name: string;
  description: string | null;
  servings: number;
  prep_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface IngredientRow {
  id: string;
  recipe_id: string;
  food_id: string;
  amount: number;
  unit: string;
  position: number;
  note: string | null;
}

/** SQL for recipes and their ingredients. */
export class RecipeRepository {
  constructor(private readonly db: SqlExecutor) {}

  private async withIngredients(rows: RecipeRow[]): Promise<Recipe[]> {
    if (rows.length === 0) return [];
    const ingredients = await this.db.query<IngredientRow>(
      `SELECT * FROM recipe_ingredients WHERE recipe_id IN (${rows.map(() => '?').join(', ')})
       ORDER BY position`,
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      name: row.name,
      description: row.description,
      servings: row.servings,
      prepMinutes: row.prep_minutes,
      notes: row.notes,
      ingredients: ingredients
        .filter((i) => i.recipe_id === row.id)
        .map((i): RecipeIngredient => ({
          id: i.id,
          foodId: i.food_id,
          amount: i.amount,
          unit: isQuantityUnit(i.unit) ? i.unit : 'g',
          position: i.position,
          note: i.note,
        })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async list(profileId: string): Promise<Recipe[]> {
    const rows = await this.db.query<RecipeRow>(
      'SELECT * FROM recipes WHERE profile_id = ? ORDER BY name COLLATE NOCASE',
      [profileId],
    );
    return this.withIngredients(rows);
  }

  async find(profileId: string, id: string): Promise<Recipe | null> {
    const rows = await this.db.query<RecipeRow>(
      'SELECT * FROM recipes WHERE id = ? AND profile_id = ?',
      [id, profileId],
    );
    return (await this.withIngredients(rows))[0] ?? null;
  }

  async insert(recipe: Recipe): Promise<void> {
    await this.db.run(
      `INSERT INTO recipes (id, profile_id, name, description, servings, prep_minutes, notes,
         created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recipe.id,
        recipe.profileId,
        recipe.name,
        recipe.description,
        recipe.servings,
        recipe.prepMinutes,
        recipe.notes,
        recipe.createdAt,
        recipe.updatedAt,
      ],
    );
    await this.replaceIngredients(recipe);
  }

  async update(recipe: Recipe): Promise<void> {
    await this.db.run(
      `UPDATE recipes SET name = ?, description = ?, servings = ?, prep_minutes = ?, notes = ?,
         updated_at = ?, sync_state = CASE sync_state WHEN 'synced' THEN 'pending' ELSE sync_state END
       WHERE id = ?`,
      [
        recipe.name,
        recipe.description,
        recipe.servings,
        recipe.prepMinutes,
        recipe.notes,
        recipe.updatedAt,
        recipe.id,
      ],
    );
    await this.replaceIngredients(recipe);
  }

  async delete(profileId: string, id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM recipes WHERE id = ? AND profile_id = ?', [
      id,
      profileId,
    ]);
    // > 0, not === 1: the native plugin also counts rows removed or cleared by foreign keys.
    return result.changes > 0;
  }

  private async replaceIngredients(recipe: Recipe) {
    await this.db.run('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipe.id]);
    for (const ingredient of recipe.ingredients) {
      await this.db.run(
        `INSERT INTO recipe_ingredients (id, recipe_id, food_id, amount, unit, position, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          ingredient.id,
          recipe.id,
          ingredient.foodId,
          ingredient.amount,
          ingredient.unit,
          ingredient.position,
          ingredient.note,
        ],
      );
    }
  }
}
