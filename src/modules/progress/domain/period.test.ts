import { periodRange, perWeek } from './period';

describe('progress period', () => {
  it('covers the last 7 local days including today', () => {
    const range = periodRange(new Date(2026, 9, 3, 23, 59), 'week');
    expect(range.from).toBe('2026-09-27');
    expect(range.to).toBe('2026-10-03');
    expect(range.dates).toHaveLength(7);
    expect(range.dates.at(-1)).toBe('2026-10-03');
  });

  it('covers the last 30 local days, also across a daylight saving change', () => {
    // Clocks go back on 25 October 2026 in Europe.
    const range = periodRange(new Date(2026, 10, 3, 0, 5), 'month');
    expect(range.from).toBe('2026-10-05');
    expect(range.to).toBe('2026-11-03');
    expect(new Set(range.dates).size).toBe(30);
  });

  it('expresses frequency per week', () => {
    expect(perWeek(3, 'week')).toBe(3);
    expect(perWeek(10, 'month')).toBe(2.3);
  });
});
