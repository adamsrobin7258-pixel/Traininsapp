/**
 * Quantity units of the nutrition module. Stored as these ids (never as display text); the UI
 * translates them (`nutrition.units.*`).
 *
 * Only units of the same dimension convert into each other (g ↔ kg, ml ↔ l). Pieces and
 * servings are food-specific: how much a piece weighs is stored with the food (see
 * FoodServing), never guessed here. Mass and volume are never converted (no density).
 */
export const QUANTITY_UNITS = ['g', 'kg', 'ml', 'l', 'piece', 'serving'] as const;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

export type UnitDimension = 'mass' | 'volume' | 'count';

/** Units whose amount a food can be measured in by weight or volume. */
export type MeasureUnit = 'g' | 'ml';
/** Food-specific counting units. */
export type CountUnit = 'piece' | 'serving';

const DEFINITIONS: Record<QuantityUnit, { dimension: UnitDimension; factor: number }> = {
  g: { dimension: 'mass', factor: 1 },
  kg: { dimension: 'mass', factor: 1000 },
  ml: { dimension: 'volume', factor: 1 },
  l: { dimension: 'volume', factor: 1000 },
  piece: { dimension: 'count', factor: 1 },
  serving: { dimension: 'count', factor: 1 },
};

export function isQuantityUnit(value: string): value is QuantityUnit {
  return (QUANTITY_UNITS as readonly string[]).includes(value);
}

export function unitDimension(unit: QuantityUnit): UnitDimension {
  return DEFINITIONS[unit].dimension;
}

export function isCountUnit(unit: QuantityUnit): unit is CountUnit {
  return unit === 'piece' || unit === 'serving';
}

/** g or ml for mass/volume units, `null` for pieces and servings. */
export function baseUnit(unit: QuantityUnit): MeasureUnit | null {
  const { dimension } = DEFINITIONS[unit];
  return dimension === 'mass' ? 'g' : dimension === 'volume' ? 'ml' : null;
}

/**
 * Converts between compatible units: kg → g, l → ml and back. The same unit returns the
 * amount unchanged (also for pieces and servings). Everything else is not convertible
 * without food-specific information and returns `null`.
 */
export function convertQuantity(
  amount: number,
  from: QuantityUnit,
  to: QuantityUnit,
): number | null {
  if (from === to) return amount;
  const source = DEFINITIONS[from];
  const target = DEFINITIONS[to];
  if (source.dimension === 'count' || source.dimension !== target.dimension) return null;
  return (amount * source.factor) / target.factor;
}
