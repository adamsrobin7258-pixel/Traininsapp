/**
 * Central unit logic for mass. Used by body weight and training loads alike, so both follow
 * the same rule: store kilograms, convert exactly once, round only for display.
 */

export const WEIGHT_UNITS = ['kg', 'lb'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

/** Exact by definition (international pound, 1959). */
export const KG_PER_LB = 0.45359237;

export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export type DecimalInputError = 'empty' | 'invalid' | 'precision';

export type ParsedDecimal = { ok: true; value: number } | { ok: false; error: DecimalInputError };

/**
 * Parses a non-negative decimal typed by the user. Accepts "82.4", "82,4" and surrounding
 * spaces; rejects signs, exponents, thousands separators and too many decimal places.
 */
export function parseDecimalInput(
  input: string,
  { maxDecimals, maxIntegerDigits = 4 }: { maxDecimals: number; maxIntegerDigits?: number },
): ParsedDecimal {
  const text = input.trim();
  if (text === '') return { ok: false, error: 'empty' };
  const match = new RegExp(`^(\\d{1,${maxIntegerDigits}})(?:[.,](\\d+))?$`).exec(text);
  if (!match) return { ok: false, error: 'invalid' };
  const decimals = match[2] ?? '';
  if (decimals.length > maxDecimals) return { ok: false, error: 'precision' };
  return { ok: true, value: Number(`${match[1] ?? ''}.${decimals || '0'}`) };
}

/** Formats a number for an input field (no grouping, trailing zeros dropped). */
export function formatDecimalInput(value: number, decimals: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
    useGrouping: false,
  }).format(roundTo(value, decimals));
}
