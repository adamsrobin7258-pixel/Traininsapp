import { getDayPeriod, getWeekDays, isSameDay, startOfWeek, toLocalDateKey } from './date';

const keys = (days: Date[]) => days.map(toLocalDateKey);

describe('getWeekDays', () => {
  it('starts on Monday by default', () => {
    expect(keys(getWeekDays(new Date(2026, 8, 30, 15)))).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });

  it('handles Sundays and year boundaries', () => {
    const days = getWeekDays(new Date(2027, 0, 3));
    expect(toLocalDateKey(days[0]!)).toBe('2026-12-28');
    expect(toLocalDateKey(days[6]!)).toBe('2027-01-03');
  });

  it('supports Sunday as the first day', () => {
    expect(toLocalDateKey(startOfWeek(new Date(2026, 8, 30), 0))).toBe('2026-09-27');
  });

  it('returns seven distinct days across a DST change', () => {
    const days = getWeekDays(new Date(2026, 9, 25, 12));
    expect(new Set(keys(days)).size).toBe(7);
    expect(days.every((day) => day.getHours() === 0)).toBe(true);
  });
});

describe('getDayPeriod', () => {
  it.each([
    [4, 'evening'],
    [5, 'morning'],
    [10, 'morning'],
    [11, 'afternoon'],
    [17, 'afternoon'],
    [18, 'evening'],
    [23, 'evening'],
  ])('%i h -> %s', (hour, expected) => {
    expect(getDayPeriod(new Date(2026, 0, 1, hour))).toBe(expected);
  });
});

describe('isSameDay', () => {
  it('ignores the time of day', () => {
    expect(isSameDay(new Date(2026, 0, 1, 0), new Date(2026, 0, 1, 23, 59))).toBe(true);
    expect(isSameDay(new Date(2026, 0, 1), new Date(2026, 0, 2))).toBe(false);
  });
});
