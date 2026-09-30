/**
 * Body weight domain: types, units, validation and formatting. Pure TypeScript.
 *
 * Storage rule: weight is always stored in kilograms. Values entered in pounds are converted
 * exactly once (no rounding) when saving; display rounds to one decimal in the chosen unit.
 * An unchanged value edited in pounds therefore round-trips to the same number.
 */

import {
  formatDecimalInput,
  fromKg,
  parseDecimalInput,
  roundTo,
  toKg,
  type WeightUnit,
} from '@/shared/lib/units';

// Unit logic is shared with training loads (src/shared/lib/units.ts).
export { fromKg, KG_PER_LB, toKg, WEIGHT_UNITS, type WeightUnit } from '@/shared/lib/units';

/**
 * Accepted range in kilograms. Covers children from about six years up to very heavy adults
 * while rejecting typos such as "8240" or "8.2". Documented in docs/DATABASE.md.
 */
export const WEIGHT_LIMITS_KG = { min: 20, max: 400 } as const;

/** Maximum decimal places accepted in user input (in the unit the user types). */
export const WEIGHT_INPUT_DECIMALS = 1;

export interface WeightEntry {
  id: string;
  profileId: string;
  /** Local calendar day, YYYY-MM-DD. One entry per profile and day. */
  date: string;
  /** Canonical value in kilograms. */
  kg: number;
  createdAt: string;
  updatedAt: string;
}

export type WeightInputError = 'empty' | 'invalid' | 'precision' | 'range';

export type ParsedWeight = { ok: true; kg: number } | { ok: false; error: WeightInputError };

/** Rounds for display/editing to the input precision. */
export function roundForDisplay(value: number): number {
  return roundTo(value, WEIGHT_INPUT_DECIMALS);
}

export function isWeightInRange(kg: number): boolean {
  return Number.isFinite(kg) && kg >= WEIGHT_LIMITS_KG.min && kg <= WEIGHT_LIMITS_KG.max;
}

/** Limits expressed in the given unit, for error messages ("20–400 kg", "44.1–881.8 lb"). */
export function weightLimitsIn(unit: WeightUnit): { min: number; max: number } {
  return {
    min: Math.ceil(fromKg(WEIGHT_LIMITS_KG.min, unit) * 10) / 10,
    max: Math.floor(fromKg(WEIGHT_LIMITS_KG.max, unit) * 10) / 10,
  };
}

/**
 * Parses what the user typed. Accepts "82.4", "82,4" and surrounding spaces; rejects
 * thousands separators, signs, exponents and more than one decimal place.
 */
export function parseWeightInput(input: string, unit: WeightUnit): ParsedWeight {
  const parsed = parseDecimalInput(input, { maxDecimals: WEIGHT_INPUT_DECIMALS });
  if (!parsed.ok) return parsed;
  const { value } = parsed;
  const kg = toKg(value, unit);
  // Compare the typed value against limits in the same unit, so the displayed limits are exact.
  const limits = weightLimitsIn(unit);
  if (value < limits.min || value > limits.max || !isWeightInRange(kg)) {
    return { ok: false, error: 'range' };
  }
  return { ok: true, kg };
}

/** Value for pre-filling an edit field, e.g. "82,4" (German) or "181.7" (English). */
export function formatWeightInput(kg: number, unit: WeightUnit, locale: string): string {
  return formatDecimalInput(fromKg(kg, unit), WEIGHT_INPUT_DECIMALS, locale);
}

/** Display value with unit, e.g. "82,4 kg". */
export function formatWeight(kg: number, unit: WeightUnit, locale: string): string {
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: WEIGHT_INPUT_DECIMALS,
    maximumFractionDigits: WEIGHT_INPUT_DECIMALS,
  }).format(roundForDisplay(fromKg(kg, unit)));
  return `${number} ${unit}`;
}

/** Signed difference for display, e.g. "−0,6 kg" / "+1,2 lb". */
export function formatWeightChange(deltaKg: number, unit: WeightUnit, locale: string): string {
  const value = roundForDisplay(fromKg(deltaKg, unit));
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: WEIGHT_INPUT_DECIMALS,
    maximumFractionDigits: WEIGHT_INPUT_DECIMALS,
    signDisplay: 'exceptZero',
  }).format(value);
  return `${number} ${unit}`;
}
