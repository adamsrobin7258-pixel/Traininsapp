import type { Clock } from '@/shared/lib/clock';
import { isLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { createId } from '@/shared/lib/id';
import { summarizeDay, type DaySummary, type FoodEntry } from './diary';
import { NutritionError } from './errors';
import { isValidAmount, nutrientsForQuantity } from './food';
import type { MealSlot } from './meals';
import { scaleNutrients } from './nutrients';
import type { NutritionRepositories, NutritionStore } from './nutritionStore';
import { recipeNutrition } from './recipe';
import type { FoodQuantity } from './savedMeal';
import { convertQuantity, isQuantityUnit, type QuantityUnit } from './units';
import { isValidWaterAmount, waterTotalMl, type WaterEntry, type WaterUnit } from './water';

export interface DayData {
  entries: FoodEntry[];
  summary: DaySummary;
  water: WaterEntry[];
  waterMl: number;
}

/**
 * The food diary: what was eaten (and drunk) on which local day. Every entry stores the
 * nutrients computed at the time it was saved, so later corrections of a food or recipe never
 * change past days.
 */
export class DiaryService {
  constructor(
    private readonly store: NutritionStore,
    private readonly clock: Clock,
  ) {}

  private now() {
    return this.clock().toISOString();
  }

  /** Today as a local calendar day – the same rule as weight and workouts. */
  todayKey(): string {
    return toLocalDateKey(this.clock());
  }

  async getDay(profileId: string, localDate: string): Promise<DayData> {
    requireDay(localDate);
    const [entries, water] = await Promise.all([
      this.store.repos.diary.listEntries(profileId, localDate, localDate),
      this.store.repos.diary.listWater(profileId, localDate, localDate),
    ]);
    return {
      entries,
      summary: summarizeDay(localDate, entries),
      water,
      waterMl: waterTotalMl(water, localDate),
    };
  }

  /** Logs a quantity of a food with its current nutrient values. */
  async addFood(
    profileId: string,
    input: FoodQuantity & { localDate: string; mealId: string; eatenAt?: string | null },
  ): Promise<FoodEntry> {
    requireDay(input.localDate);
    const now = this.now();
    return this.store.atomic(async (repos) => {
      const meal = await requireMeal(repos, profileId, input.mealId);
      const entry = await this.foodEntry(repos, profileId, input, meal, input.localDate, now);
      await repos.diary.insertEntry({ ...entry, eatenAt: input.eatenAt ?? null });
      return { ...entry, eatenAt: input.eatenAt ?? null };
    });
  }

  /**
   * Adds a saved meal to a day. `items` replaces the template's items when the user edited
   * them before adding; the template itself stays unchanged.
   */
  async addSavedMeal(
    profileId: string,
    input: { savedMealId: string; localDate: string; mealId: string; items?: FoodQuantity[] },
  ): Promise<FoodEntry[]> {
    requireDay(input.localDate);
    const template = await this.store.repos.meals.findSavedMeal(profileId, input.savedMealId);
    if (!template) throw new NutritionError('not-found');
    const items = input.items ?? template.items;
    if (items.length === 0) throw new NutritionError('invalid-value');
    const now = this.now();
    return this.store.atomic(async (repos) => {
      const meal = await requireMeal(repos, profileId, input.mealId);
      const entries: FoodEntry[] = [];
      for (const item of items) {
        const entry = await this.foodEntry(repos, profileId, item, meal, input.localDate, now);
        await repos.diary.insertEntry(entry);
        entries.push(entry);
      }
      return entries;
    });
  }

  /** Logs servings of a recipe with the recipe's current values per serving. */
  async addRecipe(
    profileId: string,
    input: { recipeId: string; servings: number; localDate: string; mealId: string },
  ): Promise<FoodEntry> {
    requireDay(input.localDate);
    if (!isValidAmount(input.servings)) throw new NutritionError('invalid-value');
    const now = this.now();
    return this.store.atomic(async (repos) => {
      const recipe = await repos.recipes.find(profileId, input.recipeId);
      if (!recipe) throw new NutritionError('not-found');
      const foods = await repos.foods.findManyById(
        profileId,
        recipe.ingredients.map((i) => i.foodId),
      );
      const perServing = recipeNutrition(recipe, new Map(foods.map((f) => [f.id, f]))).perServing;
      const meal = await requireMeal(repos, profileId, input.mealId);
      const entry: FoodEntry = {
        id: createId(),
        profileId,
        localDate: input.localDate,
        ...mealSnapshot(meal),
        foodId: null,
        recipeId: recipe.id,
        name: recipe.name,
        brand: null,
        amount: input.servings,
        unit: 'serving',
        eatenAt: null,
        nutrients: scaleNutrients(perServing.totals, input.servings),
        createdAt: now,
        updatedAt: now,
      };
      await repos.diary.insertEntry(entry);
      return entry;
    });
  }

  /**
   * Changes the quantity of an entry. The stored snapshot is rescaled – the food's current
   * values are not consulted, so history stays as it was logged. Only convertible units
   * (e.g. g ↔ kg) can be changed.
   */
  async updateQuantity(
    profileId: string,
    entryId: string,
    amount: number,
    unit: QuantityUnit,
  ): Promise<FoodEntry> {
    const entry = await this.requireEntry(profileId, entryId);
    if (!isQuantityUnit(unit) || !isValidAmount(amount)) throw new NutritionError('invalid-value');
    const inOldUnit = convertQuantity(amount, unit, entry.unit);
    if (inOldUnit === null) throw new NutritionError('incompatible-unit');
    const updated: FoodEntry = {
      ...entry,
      amount,
      unit,
      nutrients: scaleNutrients(entry.nutrients, inOldUnit / entry.amount),
      updatedAt: this.now(),
    };
    await this.store.atomic((repos) => repos.diary.updateEntryQuantity(updated));
    return updated;
  }

  /** Moves an entry to another meal and/or day. */
  async moveEntry(
    profileId: string,
    entryId: string,
    target: { localDate: string; mealId: string },
  ): Promise<void> {
    requireDay(target.localDate);
    const entry = await this.requireEntry(profileId, entryId);
    await this.store.atomic(async (repos) => {
      const meal = await requireMeal(repos, profileId, target.mealId);
      await repos.diary.moveEntry({
        ...entry,
        localDate: target.localDate,
        ...mealSnapshot(meal),
        updatedAt: this.now(),
      });
    });
  }

  async deleteEntry(profileId: string, entryId: string): Promise<void> {
    if (!(await this.store.repos.diary.deleteEntry(profileId, entryId))) {
      throw new NutritionError('not-found');
    }
  }

  // ── Water ──────────────────────────────────────────────────────────────────

  async addWater(
    profileId: string,
    input: { localDate: string; amount: number; unit: WaterUnit; drankAt?: string | null },
  ): Promise<WaterEntry> {
    requireDay(input.localDate);
    requireWater(input.amount, input.unit);
    const now = this.now();
    const entry: WaterEntry = {
      id: createId(),
      profileId,
      localDate: input.localDate,
      amount: input.amount,
      unit: input.unit,
      drankAt: input.drankAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.atomic((repos) => repos.diary.insertWater(entry));
    return entry;
  }

  /** Corrects the amount of a water entry. */
  async updateWater(
    profileId: string,
    id: string,
    amount: number,
    unit: WaterUnit,
  ): Promise<WaterEntry> {
    requireWater(amount, unit);
    const entry = await this.store.repos.diary.findWater(profileId, id);
    if (!entry) throw new NutritionError('not-found');
    const updated: WaterEntry = { ...entry, amount, unit, updatedAt: this.now() };
    await this.store.atomic((repos) => repos.diary.updateWater(updated));
    return updated;
  }

  async deleteWater(profileId: string, id: string): Promise<void> {
    if (!(await this.store.repos.diary.deleteWater(profileId, id))) {
      throw new NutritionError('not-found');
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async foodEntry(
    repos: NutritionRepositories,
    profileId: string,
    item: FoodQuantity,
    meal: MealSlot,
    localDate: string,
    now: string,
  ): Promise<FoodEntry> {
    if (!isQuantityUnit(item.unit)) throw new NutritionError('invalid-unit');
    const food = await repos.foods.findById(profileId, item.foodId);
    if (!food) throw new NutritionError('not-found');
    if (!food.active) throw new NutritionError('food-inactive');
    return {
      id: createId(),
      profileId,
      localDate,
      ...mealSnapshot(meal),
      foodId: food.id,
      recipeId: null,
      name: food.name,
      brand: food.brand,
      amount: item.amount,
      unit: item.unit,
      eatenAt: null,
      nutrients: nutrientsForQuantity(food, item.amount, item.unit),
      createdAt: now,
      updatedAt: now,
    };
  }

  private async requireEntry(profileId: string, id: string): Promise<FoodEntry> {
    const entry = await this.store.repos.diary.findEntry(profileId, id);
    if (!entry) throw new NutritionError('not-found');
    return entry;
  }
}

function requireWater(amount: number, unit: WaterUnit) {
  if (!['ml', 'l'].includes(unit) || !isValidWaterAmount(amount, unit)) {
    throw new NutritionError('invalid-value');
  }
}

function requireDay(localDate: string) {
  if (!isLocalDateKey(localDate)) throw new NutritionError('invalid-value');
}

async function requireMeal(repos: NutritionRepositories, profileId: string, mealId: string) {
  const meal = await repos.meals.findSlot(profileId, mealId);
  if (!meal) throw new NutritionError('not-found');
  return meal;
}

/** Meal name as it is at logging time (a renamed or deactivated meal keeps old days intact). */
function mealSnapshot(meal: MealSlot) {
  return { mealId: meal.id, mealDefaultKey: meal.defaultKey, mealName: meal.name };
}
