import { orderedMeals, type DefaultMealKey, type FoodEntry, type MealSlot } from '@/core/nutrition';
import { addDays, isLocalDateKey, parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';

/**
 * The day shown on the nutrition page: a valid day up to today. Future or malformed values
 * fall back to today, so nothing can be logged in advance.
 */
export function resolveDay(requested: string | null, today: string): string {
  if (!requested || !isLocalDateKey(requested) || requested > today) return today;
  return requested;
}

export function shiftDay(localDate: string, days: number): string {
  const date = parseLocalDateKey(localDate);
  return date ? toLocalDateKey(addDays(date, days)) : localDate;
}

export interface MealGroup {
  key: string;
  /** The configured meal; `null` for entries whose meal no longer exists. */
  meal: MealSlot | null;
  /** Active meals take new entries; hidden ones only show what was logged. */
  active: boolean;
  defaultKey: DefaultMealKey | null;
  name: string | null;
  entries: FoodEntry[];
}

/**
 * Sections of a day: every active meal in its configured order (also when empty), followed
 * by meals that are hidden by now but have entries on this day, so nothing logged disappears.
 */
export function groupDay(meals: readonly MealSlot[], entries: readonly FoodEntry[]): MealGroup[] {
  const byId = new Map(meals.map((meal) => [meal.id, meal]));
  const active = orderedMeals(meals);
  const groups: MealGroup[] = active.map((meal) => ({
    key: meal.id,
    meal,
    active: true,
    defaultKey: meal.defaultKey,
    name: meal.name,
    entries: entries.filter((entry) => entry.mealId === meal.id),
  }));
  const shown = new Set(active.map((meal) => meal.id));
  for (const entry of entries) {
    const key = entry.mealId ?? 'none';
    if (entry.mealId && shown.has(entry.mealId)) continue;
    let group = groups.find((candidate) => candidate.key === key);
    if (!group) {
      const meal = entry.mealId ? (byId.get(entry.mealId) ?? null) : null;
      group = {
        key,
        meal,
        active: false,
        defaultKey: meal ? meal.defaultKey : entry.mealDefaultKey,
        name: meal ? meal.name : entry.mealName,
        entries: [],
      };
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}
