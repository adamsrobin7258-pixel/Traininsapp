import { toLocalDateKey } from '@/shared/lib/date';
import { calendarRange, periodRange, perWeek, previousPeriodRange } from './period';

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

describe('calendar range: three whole weeks, Monday first', () => {
  const weekday = (key: string) => new Date(`${key}T12:00:00`).getDay();

  it('runs from Monday two weeks ago to Sunday of this week – 21 days, today inside', () => {
    // Wednesday, 14 October 2026, 09:00 local time.
    const range = calendarRange(new Date(2026, 9, 14, 9));
    expect(range.dates).toHaveLength(21);
    expect(range.from).toBe('2026-09-28');
    expect(range.to).toBe('2026-10-18');
    expect(weekday(range.from)).toBe(1);
    expect(weekday(range.to)).toBe(0);
    expect(range.today).toBe('2026-10-14');
    // Data only up to today; Thursday to Sunday are still to come.
    expect(range.untilToday).toHaveLength(17);
    expect(range.untilToday.at(-1)).toBe('2026-10-14');
  });

  it('on a Monday today is the first day of the last row; on a Sunday the last cell', () => {
    const monday = calendarRange(new Date(2026, 9, 12, 7));
    expect(monday.from).toBe('2026-09-28');
    expect(monday.untilToday).toHaveLength(15);
    const sunday = calendarRange(new Date(2026, 9, 18, 23, 59));
    expect(sunday.from).toBe('2026-09-28');
    expect(sunday.untilToday).toEqual(sunday.dates);
  });

  it('crosses months and years without gaps or doubles', () => {
    // Friday, 1 January 2027: the weeks start in December 2026.
    const range = calendarRange(new Date(2027, 0, 1, 12));
    expect(range.from).toBe('2026-12-14');
    expect(range.to).toBe('2027-01-03');
    expect(new Set(range.dates).size).toBe(21);
    for (const [index, key] of range.dates.entries()) {
      const expected = new Date(2026, 11, 14 + index);
      expect(key).toBe(toLocalDateKey(expected));
      expect(weekday(key)).toBe((index + 1) % 7);
    }
    // Leap year end of February.
    const leap = calendarRange(new Date(2028, 2, 1, 8));
    expect(leap.dates).toContain('2028-02-29');
    expect(leap.from).toBe('2028-02-14');
  });

  it('uses the local day: just after midnight and just before', () => {
    expect(calendarRange(new Date(2026, 9, 19, 0, 1)).from).toBe('2026-10-05');
    expect(calendarRange(new Date(2026, 9, 18, 23, 59)).from).toBe('2026-09-28');
    expect(calendarRange(new Date(2026, 9, 19, 0, 1)).today).toBe('2026-10-19');
  });

  it('keeps whole local days across a daylight saving change', () => {
    // Sunday, 25 October 2026: clocks go back in Central Europe.
    const range = calendarRange(new Date(2026, 9, 28, 10));
    expect(range.dates).toContain('2026-10-25');
    expect(range.dates).toContain('2026-10-26');
    expect(new Set(range.dates).size).toBe(21);
  });
});
