import { matchesFoodSearch, useNutritionData, type Recipe } from '@/core/nutrition';

export interface RecipeSummary {
  recipe: Recipe;
  /** kcal of one serving from the recipe service; `null` if it cannot be computed. */
  kcalPerServing: number | null;
}

/**
 * The profile's recipes with the energy of one serving (computed by `RecipeService.nutrition`
 * from the current food values) – for the recipe list in Meine Inhalte and in the add sheet.
 */
export function useRecipes() {
  return useNutritionData(async (s, profileId): Promise<RecipeSummary[]> => {
    const recipes = await s.recipes.list(profileId);
    return Promise.all(
      recipes.map(async (recipe) => {
        try {
          const nutrition = await s.recipes.nutrition(profileId, recipe.id);
          return { recipe, kcalPerServing: nutrition.perServing.totals.energyKcal };
        } catch {
          return { recipe, kcalPerServing: null };
        }
      }),
    );
  }, []);
}

/** Same search rule as for foods: every word of the query must appear in the name. */
export function matchesRecipe(recipe: Pick<Recipe, 'name'>, query: string): boolean {
  return matchesFoodSearch({ name: recipe.name, brand: null }, query);
}
