/** Number input for nutrition forms – shared with other areas (shared/lib/numberInput). */
import { parseNumberInput } from '@/shared/lib/numberInput';

export {
  formatNumberInput,
  parseNumberInput,
  parseOptionalNumber,
  type NumberInput,
} from '@/shared/lib/numberInput';

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
