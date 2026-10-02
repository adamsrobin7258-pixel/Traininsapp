import { periodRange, perWeek, previousPeriodRange } from './period';

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

  it('today is exactly the current local day', () => {
    const range = periodRange(new Date(2026, 9, 3, 0, 1), 'today');
    expect(range).toEqual({ from: '2026-10-03', to: '2026-10-03', dates: ['2026-10-03'] });
  });

  it('compares with the period right before, of the same length', () => {
    const now = new Date(2026, 9, 3, 10);
    expect(previousPeriodRange(now, 'today').dates).toEqual(['2026-10-02']);
    const week = previousPeriodRange(now, 'week');
    expect(week.from).toBe('2026-09-20');
    expect(week.to).toBe('2026-09-26');
    expect(week.dates).toHaveLength(7);
    const month = previousPeriodRange(now, 'month');
    expect(month.to).toBe('2026-09-03');
    expect(month.from).toBe('2026-08-05');
    expect(new Set(month.dates).size).toBe(30);
    // No gap and no overlap with the current period.
    expect(periodRange(now, 'month').from).toBe('2026-09-04');
  });
});
