import type { Food } from './food';
import type { ReferenceFood } from './reference';

/**
 * Food families for orientation (illustrations, labels). They come only from data that states
 * them: the BLS code begins with the letter of its main food group (BLS 4.0 documentation,
 * chapter 2.4). Own foods and Open Food Facts products have no family – they get `null`, and
 * the UI shows a neutral symbol instead of guessing.
 */
export const FOOD_CATEGORIES = [
  'bread',
  'grain',
  'bakery',
  'egg',
  'fruit',
  'vegetable',
  'legumes',
  'potato',
  'dairy',
  'drinks',
  'fats',
  'sweets',
  'fish',
  'meat',
  'poultry',
  'sausage',
  'dishes',
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

/**
 * BLS main group letter → family. Group R (salt, spices, sauces, baking aids) is too mixed for
 * one family and stays without one.
 */
const BLS_GROUPS: Readonly<Record<string, FoodCategory>> = {
  B: 'bread',
  C: 'grain',
  D: 'bakery',
  E: 'egg',
  F: 'fruit',
  G: 'vegetable',
  H: 'legumes',
  K: 'potato',
  M: 'dairy',
  N: 'drinks',
  P: 'drinks',
  Q: 'fats',
  S: 'sweets',
  T: 'fish',
  U: 'meat',
  V: 'poultry',
  W: 'sausage',
  X: 'dishes',
  Y: 'dishes',
};

export function blsCategory(code: string): FoodCategory | null {
  return BLS_GROUPS[code.charAt(0).toUpperCase()] ?? null;
}

/** Family of a stored food or a reference food; `null` when the data does not state it. */
export function foodCategory(
  food: Pick<Food, 'origin'> | Pick<ReferenceFood, 'dataset' | 'code'>,
): FoodCategory | null {
  if ('origin' in food) {
    return food.origin?.dataset === 'bls' ? blsCategory(food.origin.code) : null;
  }
  return food.dataset === 'bls' ? blsCategory(food.code) : null;
}
