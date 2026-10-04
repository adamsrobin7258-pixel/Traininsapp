/**
 * Nutrient values as numbers (never strings), always relative to a stated quantity. Energy in
 * kcal, everything else in grams. The four main values are required; details are optional
 * (`null` = unknown, which is different from 0).
 */
export interface Nutrients {
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  saturatedFatG: number | null;
}

export const MAIN_NUTRIENTS = ['energyKcal', 'proteinG', 'carbsG', 'fatG'] as const;
export const DETAIL_NUTRIENTS = ['fiberG', 'sugarG', 'saturatedFatG'] as const;
export type MainNutrient = (typeof MAIN_NUTRIENTS)[number];
export type DetailNutrient = (typeof DETAIL_NUTRIENTS)[number];
export type NutrientKey = MainNutrient | DetailNutrient;

export const ZERO_NUTRIENTS: Nutrients = {
  energyKcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: null,
  sugarG: null,
  saturatedFatG: null,
};

/** Stored values keep two decimals: enough for grams and kcal, free of float noise. */
export function roundNutrient(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Multiplies every value by `factor` (e.g. 1.5 for 150 g of a per-100-g food). */
export function scaleNutrients(values: Nutrients, factor: number): Nutrients {
  const scale = (value: number) => roundNutrient(value * factor);
  const scaleOptional = (value: number | null) => (value === null ? null : scale(value));
  return {
    energyKcal: scale(values.energyKcal),
    proteinG: scale(values.proteinG),
    carbsG: scale(values.carbsG),
    fatG: scale(values.fatG),
    fiberG: scaleOptional(values.fiberG),
    sugarG: scaleOptional(values.sugarG),
    saturatedFatG: scaleOptional(values.saturatedFatG),
  };
}

export interface NutrientTotals {
  totals: Nutrients;
  /**
   * Detail values that are unknown for at least one part. Their total then only covers the
   * parts that state them (or stays `null` if none does).
   */
  incomplete: DetailNutrient[];
}

/** Adds up nutrient values, e.g. the entries of a day or the ingredients of a recipe. */
export function sumNutrients(parts: readonly Nutrients[]): NutrientTotals {
  const totals: Nutrients = { ...ZERO_NUTRIENTS };
  for (const key of MAIN_NUTRIENTS) {
    totals[key] = roundNutrient(parts.reduce((sum, part) => sum + part[key], 0));
  }
  const incomplete: DetailNutrient[] = [];
  for (const key of DETAIL_NUTRIENTS) {
    const known = parts.map((part) => part[key]).filter((value): value is number => value !== null);
    totals[key] = known.length ? roundNutrient(known.reduce((sum, value) => sum + value, 0)) : null;
    if (known.length < parts.length && parts.length > 0) incomplete.push(key);
  }
  return { totals, incomplete };
}

/** Checks plausibility: finite, not negative. */
export function areValidNutrients(values: Nutrients): boolean {
  return [...MAIN_NUTRIENTS, ...DETAIL_NUTRIENTS].every((key) => {
    const value = values[key];
    return value === null
      ? DETAIL_NUTRIENTS.includes(key as DetailNutrient)
      : Number.isFinite(value) && value >= 0;
  });
}

/**
 * PRODUCT – a day's detail value (e.g. fiber) is only shown when the entries that state it make
 * up at least this share of the day's energy. Below it, a sum would describe only a small part
 * of what was eaten.
 */
export const DETAIL_MIN_COVERAGE = 0.8;

/**
 * A day's total of one detail value, honest about what is unknown (`null` is never 0):
 * - `complete`: every entry states it.
 * - `partial`: most of the day's energy is covered; the total is a lower bound ("at least").
 * - `insufficient`: some entries state it, but too few to say anything about the day.
 * - `unknown`: no entry states it (or nothing was logged).
 */
export type DetailDayTotal =
  | { status: 'complete'; grams: number }
  | { status: 'partial'; grams: number }
  | { status: 'insufficient' }
  | { status: 'unknown' };

/** The day total of one detail value from the stored entry snapshots. Pure. */
export function detailDayTotal(parts: readonly Nutrients[], key: DetailNutrient): DetailDayTotal {
  const known = parts.filter((part) => part[key] !== null);
  if (known.length === 0) return { status: 'unknown' };
  const grams = roundNutrient(known.reduce((sum, part) => sum + (part[key] ?? 0), 0));
  if (known.length === parts.length) return { status: 'complete', grams };
  const energy = (list: readonly Nutrients[]) =>
    list.reduce((sum, part) => sum + part.energyKcal, 0);
  const total = energy(parts);
  // Without energy (e.g. only zero-calorie entries) the share of entries decides.
  const coverage = total > 0 ? energy(known) / total : known.length / parts.length;
  return coverage >= DETAIL_MIN_COVERAGE
    ? { status: 'partial', grams }
    : { status: 'insufficient' };
}

/**
 * Detail values unknown for a part (`incomplete` of `sumNutrients`) become unknown for the whole:
 * a saved snapshot must not present a partial sum as the full value.
 */
export function withoutIncompleteDetails(
  values: Nutrients,
  incomplete: readonly DetailNutrient[],
): Nutrients {
  const result = { ...values };
  for (const key of incomplete) result[key] = null;
  return result;
}
