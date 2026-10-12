import type { NutritionDayGoal, NutritionDayTotals } from '@/core/nutrition';
import { progressCalendar } from './calendar';

const DATES = ['2026-10-10', '2026-10-11', '2026-10-12'];
const TODAY = '2026-10-12';

const eaten = (localDate: string, energyKcal: number): NutritionDayTotals => ({
  localDate,
  energyKcal,
  proteinG: 0,
});
const goal = (
  localDate: string,
  energyKcal: number | null,
  goalType: NutritionDayGoal['goalType'] = 'maintain',
): NutritionDayGoal => ({ localDate, energyKcal, proteinG: null, goalType });

describe('progress calendar', () => {
  it('gives one entry per day, in order, also for days without any data', () => {
    expect(progressCalendar([], [], [], DATES, TODAY)).toEqual(
      DATES.map((date) => ({ date, workouts: 0, calories: 'noData' })),
    );
  });

  it('counts completed workouts per day – several on one day stay one day', () => {
    const days = progressCalendar(
      [
        { localDate: '2026-10-10', workouts: 2, volumeKg: 900 },
        { localDate: '2026-10-12', workouts: 1, volumeKg: 0 },
      ],
      [],
      [],
      DATES,
      TODAY,
    );
    expect(days.map((day) => day.workouts)).toEqual([2, 0, 1]);
  });

  it('ignores workouts outside the days', () => {
    const days = progressCalendar(
      [{ localDate: '2026-10-09', workouts: 1, volumeKg: 0 }],
      [],
      [],
      DATES,
      TODAY,
    );
    expect(days.every((day) => day.workouts === 0)).toBe(true);
  });

  it('marks the calorie goal only when the existing rule says it was met', () => {
    const days = progressCalendar(
      [],
      [eaten('2026-10-10', 2450), eaten('2026-10-11', 3000)],
      [goal('2026-10-10', 2500), goal('2026-10-11', 2500)],
      DATES,
      TODAY,
    );
    // maintain: ±5 % is the range – 2450 of 2500 is in it, 3000 (+20 %) is not.
    expect(days.map((day) => day.calories)).toEqual(['reached', 'notReached', 'noData']);
  });

  it('reads the goal by the main goal of that day (limit, minimum, range)', () => {
    const days = progressCalendar(
      [],
      [eaten('2026-10-10', 1500), eaten('2026-10-11', 2900)],
      [goal('2026-10-10', 1800, 'lose'), goal('2026-10-11', 3000, 'gain')],
      DATES,
      TODAY,
    );
    expect(days.slice(0, 2).map((day) => day.calories)).toEqual(['reached', 'reached']);
    const missed = progressCalendar(
      [],
      [eaten('2026-10-10', 2000), eaten('2026-10-11', 2000)],
      [goal('2026-10-10', 1800, 'lose'), goal('2026-10-11', 3000, 'gain')],
      DATES,
      TODAY,
    );
    expect(missed.slice(0, 2).map((day) => day.calories)).toEqual(['notReached', 'notReached']);
  });

  it('never calls missing data a miss: no entries, no goal, today still running', () => {
    const days = progressCalendar(
      [],
      [eaten('2026-10-11', 1200), eaten(TODAY, 900)],
      [goal('2026-10-10', 2500), goal('2026-10-11', null), goal(TODAY, 2500)],
      DATES,
      TODAY,
    );
    expect(days.map((day) => day.calories)).toEqual(['noData', 'noGoal', 'open']);
  });

  it('judges today only like the score does: below the goal it is still open', () => {
    const run = (kcal: number, type: NutritionDayGoal['goalType']) =>
      progressCalendar([], [eaten(TODAY, kcal)], [goal(TODAY, 2000, type)], [TODAY], TODAY)[0]
        ?.calories;
    expect(run(1500, 'lose')).toBe('open');
    expect(run(1960, 'maintain')).toBe('open');
    expect(run(2000, 'maintain')).toBe('reached');
    expect(run(2050, 'gain')).toBe('reached');
    // Over a limit is judged today too.
    expect(run(2600, 'lose')).toBe('notReached');
  });

  it('judges training and calories independently – both can be met on one day', () => {
    const [day] = progressCalendar(
      [{ localDate: '2026-10-10', workouts: 1, volumeKg: 0 }],
      [eaten('2026-10-10', 2500)],
      [goal('2026-10-10', 2500)],
      ['2026-10-10'],
      TODAY,
    );
    expect(day).toEqual({ date: '2026-10-10', workouts: 1, calories: 'reached' });
  });
});
