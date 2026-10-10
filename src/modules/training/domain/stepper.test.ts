import { parseLoadInput } from '@/core/training';
import { isStepField, stepEntry, stepSize } from './stepper';

describe('+/− for the load', () => {
  it('steps by the load step of the unit: 1.25 kg, 2.5 lb', () => {
    expect(stepSize('weightKg', 'kg')).toBe(1.25);
    expect(stepSize('weightKg', 'lb')).toBe(2.5);
    expect(stepEntry('weightKg', '80', 1, 'kg', 'de-DE')).toBe('81,25');
    expect(stepEntry('weightKg', '80', -1, 'kg', 'de-DE')).toBe('78,75');
    expect(stepEntry('weightKg', '135', 1, 'lb', 'en-US')).toBe('137.5');
    expect(stepEntry('weightKg', '135', -1, 'lb', 'en-US')).toBe('132.5');
  });

  it('reads and writes the German decimal comma (and accepts a point)', () => {
    expect(stepEntry('weightKg', '82,5', 1, 'kg', 'de-DE')).toBe('83,75');
    expect(stepEntry('weightKg', '82.5', -1, 'kg', 'de-DE')).toBe('81,25');
    expect(stepEntry('weightKg', '82,5', 1, 'kg', 'en-US')).toBe('83.75');
  });

  it('keeps two decimals without floating point noise', () => {
    let text = '0';
    for (let i = 0; i < 9; i += 1) text = stepEntry('weightKg', text, 1, 'kg', 'de-DE') ?? '';
    expect(text).toBe('11,25');
    expect(stepEntry('weightKg', '20,1', 1, 'kg', 'de-DE')).toBe('21,35');
  });

  it('respects the limits: not below 0, not above 1000 kg', () => {
    expect(stepEntry('weightKg', '0', -1, 'kg', 'de-DE')).toBeNull();
    expect(stepEntry('weightKg', '1', -1, 'kg', 'de-DE')).toBe('0');
    expect(stepEntry('weightKg', '1000', 1, 'kg', 'de-DE')).toBeNull();
    expect(stepEntry('weightKg', '999,5', 1, 'kg', 'de-DE')).toBe('1000');
    const top = stepEntry('weightKg', '2204', 1, 'lb', 'en-US') ?? '';
    expect(top).toBe('2204.62');
    const parsed = parseLoadInput(top, 'lb');
    expect(parsed.ok && parsed.value !== null && parsed.value <= 1000).toBe(true);
  });

  it('starts an empty load at 0; invalid text is never overwritten', () => {
    expect(stepEntry('weightKg', '', 1, 'kg', 'de-DE')).toBe('1,25');
    expect(stepEntry('weightKg', '', -1, 'kg', 'de-DE')).toBeNull();
    expect(stepEntry('weightKg', 'abc', 1, 'kg', 'de-DE')).toBeNull();
    expect(stepEntry('weightKg', '80,123', 1, 'kg', 'de-DE')).toBeNull();
  });
});

describe('+/− for repetitions', () => {
  it('whole repetitions, 1 to 500', () => {
    expect(stepSize('reps', 'kg')).toBe(1);
    expect(stepEntry('reps', '8', 1, 'kg', 'de-DE')).toBe('9');
    expect(stepEntry('reps', '8', -1, 'kg', 'de-DE')).toBe('7');
    expect(stepEntry('reps', '1', -1, 'kg', 'de-DE')).toBeNull();
    expect(stepEntry('reps', '500', 1, 'kg', 'de-DE')).toBeNull();
  });

  it('empty starts at 1; decimals and text are left for the keyboard', () => {
    expect(stepEntry('reps', '', 1, 'kg', 'de-DE')).toBe('1');
    expect(stepEntry('reps', '', -1, 'kg', 'de-DE')).toBeNull();
    expect(stepEntry('reps', '8,5', 1, 'kg', 'de-DE')).toBeNull();
    expect(stepEntry('reps', 'x', 1, 'kg', 'de-DE')).toBeNull();
  });
});

it('only load and repetitions have +/−', () => {
  expect(['weightKg', 'reps', 'durationS', 'distanceM'].filter(isStepField)).toEqual([
    'weightKg',
    'reps',
  ]);
});
