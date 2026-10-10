import {
  LOAD_STEP,
  parseLoadInput,
  parseRepsInput,
  SET_LIMITS,
  WEIGHT_INPUT_DECIMALS,
} from '@/core/training';
import { formatDecimalInput, fromKg, roundTo, type WeightUnit } from '@/shared/lib/units';

/**
 * The +/− buttons of the set entry. They change the same text the keyboard edits, using the
 * existing rules: the load step of the unit (`LOAD_STEP`: 1.25 kg, 2.5 lb), whole repetitions
 * and the plausibility limits of `SET_LIMITS`. Parsing is the same as for typed input.
 */

export type StepField = 'weightKg' | 'reps';

/** Fields with +/− buttons; other fields (time, distance) are typed. */
export function isStepField(field: string): field is StepField {
  return field === 'weightKg' || field === 'reps';
}

/** How much one tap changes the value, in the shown unit. */
export function stepSize(field: StepField, unit: WeightUnit): number {
  return field === 'weightKg' ? LOAD_STEP[unit] : 1;
}

/**
 * The text after one step up (`1`) or down (`-1`), or `null` when the step changes nothing –
 * the value is already at its limit, or the text is not a valid number (then it is corrected
 * by typing, never overwritten). An empty load counts as 0; empty repetitions start at 1.
 */
export function stepEntry(
  field: StepField,
  text: string,
  direction: 1 | -1,
  unit: WeightUnit,
  locale: string,
): string | null {
  if (field === 'weightKg') {
    const parsed = parseLoadInput(text, unit);
    if (!parsed.ok) return null;
    const current = parsed.value === null ? 0 : fromKg(parsed.value, unit);
    const min = SET_LIMITS.weightKg.min;
    // The highest load in the shown unit that still converts into the limit.
    const max = Math.floor(fromKg(SET_LIMITS.weightKg.max, unit) * 100) / 100;
    const next = Math.min(
      max,
      Math.max(min, roundTo(current + direction * LOAD_STEP[unit], WEIGHT_INPUT_DECIMALS)),
    );
    if (parsed.value !== null && next === roundTo(current, WEIGHT_INPUT_DECIMALS)) return null;
    if (parsed.value === null && direction === -1) return null;
    return formatDecimalInput(next, WEIGHT_INPUT_DECIMALS, locale);
  }
  const parsed = parseRepsInput(text);
  if (!parsed.ok) return null;
  const { min, max } = SET_LIMITS.reps;
  if (parsed.value === null) return direction === 1 ? String(min) : null;
  const next = Math.min(max, Math.max(min, parsed.value + direction));
  return next === parsed.value ? null : formatDecimalInput(next, 0, locale);
}
