import { resolveSelectedDay, shiftByWeeks } from './selectedDay';

const today = '2026-10-03';

describe('resolveSelectedDay', () => {
  it.each([
    [null, today],
    ['', today],
    ['2026-10-01', '2026-10-01'],
    ['2026-10-03', today],
    ['2026-10-04', today],
    ['2026-13-01', today],
    ['yesterday', today],
  ])('%j -> %s', (requested, expected) => {
    expect(resolveSelectedDay(requested, today)).toBe(expected);
  });
});

describe('shiftByWeeks', () => {
  it('moves back across month and year boundaries', () => {
    expect(shiftByWeeks('2026-10-03', -1, today)).toBe('2026-09-26');
    expect(shiftByWeeks('2026-01-02', -1, today)).toBe('2025-12-26');
  });

  it('never moves past today', () => {
    expect(shiftByWeeks('2026-09-30', 1, today)).toBe(today);
    expect(shiftByWeeks('2026-09-20', 1, today)).toBe('2026-09-27');
  });
});
