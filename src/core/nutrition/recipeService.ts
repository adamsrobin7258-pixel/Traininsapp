import type { Clock } from '@/shared/lib/clock';
import { createId } from '@/shared/lib/id';
import { NutritionError } from './errors';
import { isValidAmount } from './food';
import { optionalText, requireName } from './names';
import type { NutritionStore } from './nutritionStore';
import {
  RECIPE_NAME_MAX_LENGTH,
  recipeNutrition,
  type Recipe,
  type RecipeNutrition,
} from './recipe';
import type { FoodQuantity } from './savedMeal';
import { isQuantityUnit } from './units';

export interface RecipeInput {
  name: string;
  description?: string | null;
  servings: number;
  prepMinutes?: number | null;
  notes?: string | null;
  ingredients: (FoodQuantity & { note?: string | null })[];
}

/** Recipes and their nutrients (total and per serving, from current food values). */
export class RecipeService {
  constructor(
    private readonly store: NutritionStore,
    private readonly clock: Clock,
  ) {}

  private now() {
    return this.clock().toISOString();
  }

  list(profileId: string): Promise<Recipe[]> {
    return this.store.repos.recipes.list(profileId);
  }

  async get(profileId: string, id: string): Promise<Recipe> {
    const recipe = await this.store.repos.recipes.find(profileId, id);
    if (!recipe) throw new NutritionError('not-found');
    return recipe;
  }

  async create(profileId: string, input: RecipeInput): Promise<Recipe> {
    const now = this.now();
    const recipe: Recipe = {
      id: createId(),
      profileId,
      ...(await this.checked(profileId, input)),
      createdAt: now,
      updatedAt: now,
    };
    await this.store.atomic((repos) => repos.recipes.insert(recipe));
    return recipe;
  }

  async update(profileId: string, id: string, input: RecipeInput): Promise<Recipe> {
    const current = await this.get(profileId, id);
    const recipe: Recipe = {
      ...current,
      ...(await this.checked(profileId, input)),
      updatedAt: this.now(),
    };
    await this.store.atomic((repos) => repos.recipes.update(recipe));
    return recipe;
  }

  /** Deleting a recipe keeps logged portions (they are snapshots). */
  async delete(profileId: string, id: string): Promise<void> {
    if (!(await this.store.repos.recipes.delete(profileId, id))) {
      throw new NutritionError('not-found');
    }
  }

  async nutrition(profileId: string, id: string): Promise<RecipeNutrition> {
    const recipe = await this.get(profileId, id);
    const foods = await this.store.repos.foods.findManyById(
      profileId,
      recipe.ingredients.map((i) => i.foodId),
    );
    return recipeNutrition(recipe, new Map(foods.map((food) => [food.id, food])));
  }

  private async checked(profileId: string, input: RecipeInput) {
    if (!Number.isFinite(input.servings) || input.servings <= 0 || input.servings > 100) {
      throw new NutritionError('invalid-value');
    }
    const prep = input.prepMinutes ?? null;
    if (prep !== null && (!Number.isInteger(prep) || prep < 0 || prep > 24 * 60)) {
      throw new NutritionError('invalid-value');
    }
    const foods = await this.store.repos.foods.findManyById(
      profileId,
      input.ingredients.map((i) => i.foodId),
    );
    const known = new Set(foods.map((food) => food.id));
    return {
      name: requireName(input.name, RECIPE_NAME_MAX_LENGTH),
      description: optionalText(input.description, 2000),
      servings: input.servings,
      prepMinutes: prep,
      notes: optionalText(input.notes, 2000),
      ingredients: input.ingredients.map((ingredient, position) => {
        if (!known.has(ingredient.foodId)) throw new NutritionError('not-found');
        if (!isQuantityUnit(ingredient.unit) || !isValidAmount(ingredient.amount)) {
          throw new NutritionError('invalid-value');
        }
        return {
          id: createId(),
          foodId: ingredient.foodId,
          amount: ingredient.amount,
          unit: ingredient.unit,
          position,
          note: optionalText(ingredient.note, 200),
        };
      }),
    };
  }
}
