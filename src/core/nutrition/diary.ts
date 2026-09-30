import type { DefaultMealKey } from './meals';
import { sumNutrients, type NutrientTotals, type Nutrients } from './nutrients';
import type { QuantityUnit } from './units';

/**
 * One eaten food (or recipe portion) on a local calendar day.
 *
 * The nutrients are a snapshot computed when the entry was saved. Correcting a food later
 * therefore never changes past days. The food and meal are referenced for convenience
 * ("eat again"), but name and meal name are stored as well, so the entry stays readable when
 * they change or disappear.
 */
export interface FoodEntry {
  id: string;
  profileId: string;
  /** Local calendar day YYYY-MM-DD (same rule as weight and workouts). */
  localDate: string;
  mealId: string | null;
  mealDefaultKey: DefaultMealKey | null;
  mealName: string | null;
  foodId: string | null;
  recipeId: string | null;
  name: string;
  brand: string | null;
  amount: number;
  unit: QuantityUnit;
  /** Optional time of eating (ISO-8601 UTC). */
  eatenAt: string | null;
  nutrients: Nutrients;
  createdAt: string;
  updatedAt: string;
}

export interface MealTotals {
  mealId: string | null;
  totals: NutrientTotals;
  entryCount: number;
}

export interface DaySummary {
  localDate: string;
  totals: NutrientTotals;
  /** Per meal, in the order of first appearance of the entries passed in. */
  meals: MealTotals[];
  entryCount: number;
}

/** Adds up a day's entries overall and per meal. Pure; the service loads the entries. */
export function summarizeDay(localDate: string, entries: readonly FoodEntry[]): DaySummary {
  const own = entries.filter((entry) => entry.localDate === localDate);
  const byMeal = new Map<string | null, FoodEntry[]>();
  for (const entry of own) {
    byMeal.set(entry.mealId, [...(byMeal.get(entry.mealId) ?? []), entry]);
  }
  return {
    localDate,
    totals: sumNutrients(own.map((entry) => entry.nutrients)),
    meals: [...byMeal.entries()].map(([mealId, list]) => ({
      mealId,
      totals: sumNutrients(list.map((entry) => entry.nutrients)),
      entryCount: list.length,
    })),
    entryCount: own.length,
  };
}
