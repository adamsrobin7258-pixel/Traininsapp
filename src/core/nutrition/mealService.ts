import type { Clock } from '@/shared/lib/clock';
import { createId } from '@/shared/lib/id';
import { NutritionError } from './errors';
import { isValidAmount } from './food';
import { DEFAULT_MEAL_KEYS, MEAL_NAME_MAX_LENGTH, orderedMeals, type MealSlot } from './meals';
import { requireName } from './names';
import type { NutritionStore } from './nutritionStore';
import { SAVED_MEAL_NAME_MAX_LENGTH, type FoodQuantity, type SavedMeal } from './savedMeal';
import { isQuantityUnit } from './units';

/** Meal configuration and saved meal templates. */
export class MealService {
  constructor(
    private readonly store: NutritionStore,
    private readonly clock: Clock,
  ) {}

  private now() {
    return this.clock().toISOString();
  }

  /** Creates the four default meals for a profile that has none yet (idempotent). */
  async ensureDefaults(profileId: string): Promise<void> {
    const now = this.now();
    await this.store.atomic(async (repos) => {
      if ((await repos.meals.listSlots(profileId)).length > 0) return;
      for (const [position, defaultKey] of DEFAULT_MEAL_KEYS.entries()) {
        await repos.meals.insertSlot(
          { id: createId(), profileId, defaultKey, name: null, position, active: true },
          now,
        );
      }
    });
  }

  /** All meals including deactivated ones, in order. */
  listAll(profileId: string): Promise<MealSlot[]> {
    return this.store.repos.meals.listSlots(profileId);
  }

  /** Meals offered for new entries. */
  async listActive(profileId: string): Promise<MealSlot[]> {
    return orderedMeals(await this.listAll(profileId));
  }

  async add(profileId: string, name: string): Promise<MealSlot> {
    const slots = await this.listAll(profileId);
    const slot: MealSlot = {
      id: createId(),
      profileId,
      defaultKey: null,
      name: requireName(name, MEAL_NAME_MAX_LENGTH),
      position: slots.length,
      active: true,
    };
    await this.store.atomic((repos) => repos.meals.insertSlot(slot, this.now()));
    return slot;
  }

  async rename(profileId: string, id: string, name: string): Promise<void> {
    await this.requireSlot(profileId, id);
    await this.store.repos.meals.renameSlot(
      id,
      requireName(name, MEAL_NAME_MAX_LENGTH),
      this.now(),
    );
  }

  /**
   * Deactivating replaces deleting: logged days keep their meal. At least one meal stays
   * active so entries always have a place.
   */
  async setActive(profileId: string, id: string, active: boolean): Promise<void> {
    await this.requireSlot(profileId, id);
    if (!active && (await this.listActive(profileId)).filter((m) => m.id !== id).length === 0) {
      throw new NutritionError('last-meal');
    }
    await this.store.repos.meals.setSlotActive(id, active, this.now());
  }

  /** Moves a meal one place up (-1) or down (+1) among all meals. */
  async move(profileId: string, id: string, delta: -1 | 1): Promise<void> {
    const slots = await this.listAll(profileId);
    const index = slots.findIndex((slot) => slot.id === id);
    if (index < 0) throw new NutritionError('not-found');
    const target = index + delta;
    if (target < 0 || target >= slots.length) return;
    const ordered = slots.map((slot) => slot.id);
    [ordered[index], ordered[target]] = [ordered[target] ?? id, ordered[index] ?? id];
    await this.store.atomic((repos) => repos.meals.setSlotPositions(ordered, this.now()));
  }

  // ── Saved meals (templates) ───────────────────────────────────────────────

  listSavedMeals(profileId: string): Promise<SavedMeal[]> {
    return this.store.repos.meals.listSavedMeals(profileId);
  }

  async getSavedMeal(profileId: string, id: string): Promise<SavedMeal> {
    const meal = await this.store.repos.meals.findSavedMeal(profileId, id);
    if (!meal) throw new NutritionError('not-found');
    return meal;
  }

  async saveMeal(
    profileId: string,
    input: { name: string; mealId?: string | null; items: FoodQuantity[] },
  ): Promise<SavedMeal> {
    const now = this.now();
    const meal: SavedMeal = {
      id: createId(),
      profileId,
      ...(await this.checkedTemplate(profileId, input)),
      createdAt: now,
      updatedAt: now,
    };
    await this.store.atomic((repos) => repos.meals.insertSavedMeal(meal));
    return meal;
  }

  async updateSavedMeal(
    profileId: string,
    id: string,
    input: { name: string; mealId?: string | null; items: FoodQuantity[] },
  ): Promise<SavedMeal> {
    const current = await this.getSavedMeal(profileId, id);
    const meal: SavedMeal = {
      ...current,
      ...(await this.checkedTemplate(profileId, input)),
      updatedAt: this.now(),
    };
    await this.store.atomic((repos) => repos.meals.updateSavedMeal(meal));
    return meal;
  }

  async deleteSavedMeal(profileId: string, id: string): Promise<void> {
    if (!(await this.store.repos.meals.deleteSavedMeal(profileId, id))) {
      throw new NutritionError('not-found');
    }
  }

  private async checkedTemplate(
    profileId: string,
    input: { name: string; mealId?: string | null; items: FoodQuantity[] },
  ) {
    if (input.items.length === 0) throw new NutritionError('invalid-value');
    if (input.mealId) await this.requireSlot(profileId, input.mealId);
    const foods = await this.store.repos.foods.findManyById(
      profileId,
      input.items.map((item) => item.foodId),
    );
    const known = new Set(foods.map((food) => food.id));
    return {
      name: requireName(input.name, SAVED_MEAL_NAME_MAX_LENGTH),
      mealId: input.mealId ?? null,
      items: input.items.map((item, position) => {
        if (!known.has(item.foodId)) throw new NutritionError('not-found');
        if (!isQuantityUnit(item.unit) || !isValidAmount(item.amount)) {
          throw new NutritionError('invalid-value');
        }
        return {
          id: createId(),
          foodId: item.foodId,
          amount: item.amount,
          unit: item.unit,
          position,
        };
      }),
    };
  }

  private async requireSlot(profileId: string, id: string): Promise<MealSlot> {
    const slot = await this.store.repos.meals.findSlot(profileId, id);
    if (!slot) throw new NutritionError('not-found');
    return slot;
  }
}
