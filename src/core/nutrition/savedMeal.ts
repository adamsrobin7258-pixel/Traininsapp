import type { QuantityUnit } from './units';

/**
 * A reusable template of several foods ("Standard-Frühstück"). It is not a logged day:
 * applying it creates new diary entries with the foods' current values, and it can be edited
 * before that. Items reference foods, not nutrient snapshots.
 */
export interface SavedMeal {
  id: string;
  profileId: string;
  name: string;
  /** Meal it is usually eaten at, as a default when applying it. */
  mealId: string | null;
  items: SavedMealItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SavedMealItem {
  id: string;
  foodId: string;
  amount: number;
  unit: QuantityUnit;
  position: number;
}

/** A food with a quantity, e.g. an item when applying or saving a template. */
export interface FoodQuantity {
  foodId: string;
  amount: number;
  unit: QuantityUnit;
}

export const SAVED_MEAL_NAME_MAX_LENGTH = 60;
