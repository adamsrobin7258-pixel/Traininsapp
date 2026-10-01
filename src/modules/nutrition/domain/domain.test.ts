import type { FoodEntry, MealSlot } from '@/core/nutrition';
import { ZERO_NUTRIENTS } from '@/core/nutrition';
import { groupDay, resolveDay, shiftDay } from './day';
import { formatNumberInput, parseAmountInput, parseNumberInput } from './input';

const meal = (id: string, position: number, active = true): MealSlot => ({
  id,
  profileId: 'p',
  defaultKey: null,
  name: id,
  position,
  active,
});

const entry = (id: string, mealId: string | null): FoodEntry => ({
  id,
  profileId: 'p',
  localDate: '2026-10-03',
  mealId,
  mealDefaultKey: null,
  mealName: mealId ? `${mealId} (logged)` : null,
  foodId: 'f',
  recipeId: null,
  name: id,
  brand: null,
  amount: 100,
  unit: 'g',
  eatenAt: null,
  nutrients: ZERO_NUTRIENTS,
  createdAt: '',
  updatedAt: '',
});

describe('number input', () => {
  it('accepts a decimal comma or point and reports problems', () => {
    expect(parseNumberInput('12,5')).toEqual({ ok: true, value: 12.5 });
    expect(parseNumberInput(' 80 ')).toEqual({ ok: true, value: 80 });
    expect(parseNumberInput('0.5')).toEqual({ ok: true, value: 0.5 });
    expect(parseNumberInput('')).toEqual({ ok: false, error: 'empty' });
    expect(parseNumberInput('-3')).toEqual({ ok: false, error: 'negative' });
    expect(parseNumberInput('12a')).toEqual({ ok: false, error: 'invalid' });
    expect(parseNumberInput('1,2,3')).toEqual({ ok: false, error: 'invalid' });
  });

  it('checks the range of logged amounts', () => {
    const valid = (value: number) => value > 0 && value <= 10_000;
    expect(parseAmountInput('0', valid)).toEqual({ ok: false, error: 'range' });
    expect(parseAmountInput('150', valid)).toEqual({ ok: true, value: 150 });
  });

  it('shows stored numbers in the user’s notation', () => {
    expect(formatNumberInput(12.5, 'de')).toBe('12,5');
    expect(formatNumberInput(1500, 'de')).toBe('1500');
    expect(formatNumberInput(null, 'de')).toBe('');
  });
});

describe('days', () => {
  it('never goes beyond today', () => {
    expect(resolveDay(null, '2026-10-03')).toBe('2026-10-03');
    expect(resolveDay('2026-10-01', '2026-10-03')).toBe('2026-10-01');
    expect(resolveDay('2026-10-04', '2026-10-03')).toBe('2026-10-03');
    expect(resolveDay('2026-02-30', '2026-10-03')).toBe('2026-10-03');
    expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30');
  });

  it('groups entries by active meals and keeps hidden meals with entries', () => {
    const meals = [meal('lunch', 1), meal('breakfast', 0), meal('late', 2, false)];
    const groups = groupDay(meals, [
      entry('a', 'breakfast'),
      entry('b', 'late'),
      entry('c', 'gone'),
    ]);
    expect(groups.map((g) => [g.key, g.active, g.entries.map((e) => e.id)])).toEqual([
      ['breakfast', true, ['a']],
      ['lunch', true, []],
      ['late', false, ['b']],
      ['gone', false, ['c']],
    ]);
    expect(groups[3]?.name).toBe('gone (logged)');
  });
});
