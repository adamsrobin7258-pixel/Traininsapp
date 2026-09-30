/**
 * Meals of a day ("Frühstück", "Mittagessen", …) are configurable data, not fixed UI blocks.
 * Every profile starts with four defaults; they can be renamed, reordered, added and
 * deactivated. Defaults keep a `defaultKey` so their name follows the app language until the
 * user renames them.
 */
export const DEFAULT_MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
export type DefaultMealKey = (typeof DEFAULT_MEAL_KEYS)[number];

export interface MealSlot {
  id: string;
  profileId: string;
  /** Set for the four defaults; the translated name is used while `name` is empty. */
  defaultKey: DefaultMealKey | null;
  /** User-chosen name; overrides the default name. */
  name: string | null;
  position: number;
  /** Deactivated meals disappear from new entries; logged days keep their meal. */
  active: boolean;
}

export const MEAL_NAME_MAX_LENGTH = 40;

/** Display name: the user's name, else the translated default (`translate(defaultKey)`). */
export function mealDisplayName(
  meal: Pick<MealSlot, 'defaultKey' | 'name'>,
  translate: (key: DefaultMealKey) => string,
): string {
  if (meal.name) return meal.name;
  return meal.defaultKey ? translate(meal.defaultKey) : '';
}

/** Active meals in their configured order. */
export function orderedMeals<T extends Pick<MealSlot, 'position' | 'active'>>(
  meals: readonly T[],
): T[] {
  return meals.filter((meal) => meal.active).sort((a, b) => a.position - b.position);
}
