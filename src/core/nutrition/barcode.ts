/**
 * Barcodes of food packages (GTIN): EAN-13, EAN-8, UPC-A (12 digits), UPC-E (8 digits) and
 * GTIN-14. Validation stays deliberately simple – only digits and a plausible length – so no
 * real product is blocked (some store codes have unusual check digits).
 */
export const BARCODE_LENGTH = { min: 8, max: 14 } as const;

/** Digits of a typed or scanned code without spaces or dashes; `null` if not plausible. */
export function normalizeBarcode(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length < BARCODE_LENGTH.min || digits.length > BARCODE_LENGTH.max) return null;
  return digits;
}

/**
 * Spellings of the same product code: a UPC-A code (12 digits) is the EAN-13 code with a
 * leading 0. Used to find a locally stored product regardless of how it was scanned.
 */
export function barcodeVariants(code: string): string[] {
  if (code.length === 12) return [code, `0${code}`];
  if (code.length === 13 && code.startsWith('0')) return [code, code.slice(1)];
  return [code];
}
