/**
 * Number input for nutrition forms. Accepts a decimal comma or point ("12,5", "12.5"); the
 * caller decides about limits. Never guesses: anything unclear is reported as an error.
 */
export type NumberInput =
  { ok: true; value: number } | { ok: false; error: 'empty' | 'invalid' | 'negative' };

export function parseNumberInput(text: string): NumberInput {
  const trimmed = text.trim().replace(/\s/g, '');
  if (trimmed === '') return { ok: false, error: 'empty' };
  if (/^-/.test(trimmed)) {
    return /^-\d+([.,]\d+)?$/.test(trimmed)
      ? { ok: false, error: 'negative' }
      : { ok: false, error: 'invalid' };
  }
  if (!/^(\d+([.,]\d*)?|[.,]\d+)$/.test(trimmed)) return { ok: false, error: 'invalid' };
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? { ok: true, value } : { ok: false, error: 'invalid' };
}

/** An optional field: empty is `null`, anything else must be a valid number. */
export function parseOptionalNumber(text: string): NumberInput | { ok: true; value: null } {
  return text.trim() === '' ? { ok: true, value: null } : parseNumberInput(text);
}

/** Shows a stored number in an input field, e.g. 12.5 → "12,5" in German. */
export function formatNumberInput(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(
    value,
  );
}

export type AmountError = 'empty' | 'invalid' | 'negative' | 'range';

/** A logged quantity: a number above 0 and at most 10,000 (same rule as the core). */
export function parseAmountInput(
  text: string,
  isValid: (value: number) => boolean,
): { ok: true; value: number } | { ok: false; error: AmountError } {
  const parsed = parseNumberInput(text);
  if (!parsed.ok) return parsed;
  return isValid(parsed.value) ? parsed : { ok: false, error: 'range' };
}
