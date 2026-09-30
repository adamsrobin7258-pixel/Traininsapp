import { nutrientsForQuantity, type Food } from './food';
import { scaleNutrients, sumNutrients, type NutrientTotals } from './nutrients';
import type { QuantityUnit } from './units';

/**
 * A recipe: ingredients (foods with amount and unit) for a number of servings. Ingredients
 * reference foods, so the structure can later also produce a shopping list.
 */
export interface Recipe {
  id: string;
  profileId: string;
  name: string;
  description: string | null;
  /** Number of servings the ingredients make (may be fractional, e.g. 2.5). */
  servings: number;
  prepMinutes: number | null;
  notes: string | null;
  ingredients: RecipeIngredient[];
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  id: string;
  foodId: string;
  amount: number;
  unit: QuantityUnit;
  position: number;
  note: string | null;
}

export const RECIPE_NAME_MAX_LENGTH = 120;

export interface RecipeNutrition {
  total: NutrientTotals;
  perServing: NutrientTotals;
}

/**
 * Nutrients of the whole recipe and of one serving, from the current food values. Detail
 * values missing for some ingredients are reported in `incomplete`.
 */
export function recipeNutrition(
  recipe: Pick<Recipe, 'servings' | 'ingredients'>,
  foods: ReadonlyMap<string, Pick<Food, 'reference' | 'servings' | 'nutrients'>>,
): RecipeNutrition {
  const parts = recipe.ingredients.map((ingredient) => {
    const food = foods.get(ingredient.foodId);
    if (!food) throw new Error(`Food ${ingredient.foodId} of the recipe is missing`);
    return nutrientsForQuantity(food, ingredient.amount, ingredient.unit);
  });
  const total = sumNutrients(parts);
  return {
    total,
    perServing: {
      totals: scaleNutrients(total.totals, 1 / recipe.servings),
      incomplete: total.incomplete,
    },
  };
}
