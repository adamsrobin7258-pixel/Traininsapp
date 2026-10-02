import {
  formatWeight,
  formatWeightChange,
  formatWeightInput,
  fromKg,
  KG_PER_LB,
  parseWeightInput,
  toKg,
  weightLimitsIn,
} from './weight';
import { ACTIVITY_WEIGHT_WINDOW_DAYS, pickActivityWeight } from './weightRules';

describe('parseWeightInput', () => {
  it.each([
    ['82.4', 82.4],
    ['82,4', 82.4],
    [' 82 ', 82],
    ['20', 20],
    ['400', 400],
    ['400,0', 400],
  ])('accepts %j in kg', (input, kg) => {
    expect(parseWeightInput(input, 'kg')).toEqual({ ok: true, kg });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['abc', 'invalid'],
    ['-80', 'invalid'],
    ['+80', 'invalid'],
    ['8e1', 'invalid'],
    ['1.000,5', 'invalid'],
    ['82.', 'invalid'],
    ['82.45', 'precision'],
    ['0', 'range'],
    ['19.9', 'range'],
    ['400.1', 'range'],
    ['8240', 'range'],
  ])('rejects %j (%s)', (input, error) => {
    expect(parseWeightInput(input, 'kg')).toEqual({ ok: false, error });
  });

  it('converts pounds exactly once', () => {
    expect(parseWeightInput('180', 'lb')).toEqual({ ok: true, kg: 180 * KG_PER_LB });
  });

  it('uses the limits shown to the user in pounds', () => {
    expect(weightLimitsIn('lb')).toEqual({ min: 44.1, max: 881.8 });
    expect(parseWeightInput('44', 'lb')).toEqual({ ok: false, error: 'range' });
    expect(parseWeightInput('44.1', 'lb').ok).toBe(true);
    expect(parseWeightInput('881.8', 'lb').ok).toBe(true);
    expect(parseWeightInput('881.9', 'lb')).toEqual({ ok: false, error: 'range' });
    expect(weightLimitsIn('kg')).toEqual({ min: 20, max: 400 });
  });
});

describe('unit conversion', () => {
  it('round-trips without drift', () => {
    for (const lb of [44.1, 99.9, 180, 181.7, 881.8]) {
      expect(fromKg(toKg(lb, 'lb'), 'lb')).toBeCloseTo(lb, 10);
    }
  });

  it('keeps an unchanged value when editing in pounds repeatedly', () => {
    let kg = toKg(181.7, 'lb');
    for (let i = 0; i < 10; i += 1) {
      const shown = formatWeightInput(kg, 'lb', 'en');
      const parsed = parseWeightInput(shown, 'lb');
      if (!parsed.ok) throw new Error('parse failed');
      kg = parsed.kg;
    }
    expect(formatWeightInput(kg, 'lb', 'en')).toBe('181.7');
  });
});

describe('formatting', () => {
  it('formats per locale and unit', () => {
    expect(formatWeight(82.4, 'kg', 'de')).toBe('82,4 kg');
    expect(formatWeight(82, 'kg', 'en')).toBe('82.0 kg');
    expect(formatWeight(toKg(180, 'lb'), 'lb', 'en')).toBe('180.0 lb');
    expect(formatWeight(1234.5, 'kg', 'en')).toBe('1,234.5 kg');
  });

  it('pre-fills edit fields without grouping or trailing zeros', () => {
    expect(formatWeightInput(82.4, 'kg', 'de')).toBe('82,4');
    expect(formatWeightInput(82, 'kg', 'de')).toBe('82');
  });

  it('shows signed changes', () => {
    // ICU uses U+2212 or '-' depending on the platform data.
    expect(formatWeightChange(-0.6, 'kg', 'de')).toMatch(/^[-−]0,6 kg$/);
    expect(formatWeightChange(1.2, 'kg', 'en')).toBe('+1.2 kg');
    expect(formatWeightChange(0.01, 'kg', 'en')).toBe('0.0 kg');
  });
});

describe('weight rule 3: activity weight', () => {
  it('takes the own entry unless a Health Connect value is newer; own wins on the same day', () => {
    const own = { date: '2026-10-01', kg: 84 };
    expect(pickActivityWeight(own, [])).toEqual({ ...own, source: 'own' });
    expect(pickActivityWeight(own, [{ date: '2026-10-01', kg: 86 }])).toEqual({
      ...own,
      source: 'own',
    });
    expect(
      pickActivityWeight(own, [
        { date: '2026-09-20', kg: 85 },
        { date: '2026-10-02', kg: 86 },
      ]),
    ).toEqual({ date: '2026-10-02', kg: 86, source: 'imported' });
    expect(pickActivityWeight(null, [{ date: '2026-09-20', kg: 85 }])).toEqual({
      date: '2026-09-20',
      kg: 85,
      source: 'imported',
    });
    expect(pickActivityWeight(null, [])).toBeNull();
    expect(ACTIVITY_WEIGHT_WINDOW_DAYS).toBe(60);
  });
});
