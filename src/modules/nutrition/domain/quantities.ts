import type { TranslateFn } from '@/core/i18n';
import {
  isValidAmount,
  unitsFor,
  type Food,
  type FoodQuantity,
  type QuantityUnit,
} from '@/core/nutrition';
import { describeAmountError } from './format';
import { formatNumberInput, parseAmountInput } from './input';

/**
 * A food with an amount as typed – one ingredient of a recipe or one item of a template while
 * it is edited. `key` is stable for the list (new rows get a local key, never a stored id).
 */
export interface QuantityDraft {
  key: string;
  foodId: string;
  amount: string;
  unit: QuantityUnit;
  note: string;
}

let nextKey = 0;
/** A local list key for a row that has no stored id yet. */
export function draftKey(): string {
  nextKey += 1;
  return `draft-${nextKey}`;
}

/** A new row for a picked food: its reference amount and unit, like when logging it. */
export function draftForFood(food: Pick<Food, 'id' | 'reference'>, locale: string): QuantityDraft {
  return {
    key: draftKey(),
    foodId: food.id,
    amount: formatNumberInput(food.reference.amount, locale),
    unit: food.reference.unit,
    note: '',
  };
}

/** A stored quantity as an editable row. */
export function draftFromQuantity(
  item: FoodQuantity & { id: string; note?: string | null },
  locale: string,
): QuantityDraft {
  return {
    key: item.id,
    foodId: item.foodId,
    amount: formatNumberInput(item.amount, locale),
    unit: item.unit,
    note: item.note ?? '',
  };
}

/**
 * Units a row can use: those the food can be converted to (same rule as when logging), plus
 * the row's current unit so a stored value is never changed silently.
 */
export function unitsForDraft(
  food: Pick<Food, 'reference' | 'servings'> | undefined,
  current: QuantityUnit,
): QuantityUnit[] {
  const units = food ? unitsFor(food) : [];
  return units.includes(current) ? units : [...units, current];
}

/** Checks every amount with the core rule (above 0, at most 10,000); errors by row key. */
export function parseQuantities(
  drafts: readonly QuantityDraft[],
  t: TranslateFn,
):
  | { ok: true; items: (FoodQuantity & { note: string | null })[] }
  | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const items: (FoodQuantity & { note: string | null })[] = [];
  for (const draft of drafts) {
    const parsed = parseAmountInput(draft.amount, isValidAmount);
    if (parsed.ok) {
      const note = draft.note.trim();
      items.push({
        foodId: draft.foodId,
        amount: parsed.value,
        unit: draft.unit,
        note: note === '' ? null : note,
      });
    } else {
      errors[draft.key] = describeAmountError(parsed.error, t);
    }
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, items };
}
