import { summarizeStepGoal } from './steps';

const dates = [
  '2026-09-27',
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
];

describe('steps against the step goal', () => {
  it('counts only days with a goal and a value; missing days are neutral', () => {
    const result = summarizeStepGoal(
      [
        { date: '2026-09-28', steps: 9000 },
        { date: '2026-09-30', steps: null },
        { date: '2026-10-02', steps: 7999 },
        { date: '2026-10-03', steps: 6200 },
      ],
      dates,
      () => 8000,
    );
    expect(result).toEqual({
      today: { steps: 6200, goal: 8000, ratio: 0.775 },
      ratedDays: 3,
      reachedDays: 1,
    });
  });

  it('uses the goal of each day (versioned) and has no today without a goal', () => {
    const goalOn = (date: string) => (date < '2026-10-01' ? 5000 : null);
    const result = summarizeStepGoal(
      [
        { date: '2026-09-29', steps: 6000 },
        { date: '2026-10-03', steps: 6000 },
      ],
      dates,
      goalOn,
    );
    expect(result).toEqual({ today: null, ratedDays: 1, reachedDays: 1 });
  });

  it('shows today’s goal without steps as not yet known', () => {
    expect(summarizeStepGoal([], dates, () => 8000)).toEqual({
      today: { steps: null, goal: 8000, ratio: null },
      ratedDays: 0,
      reachedDays: 0,
    });
  });
});
