import { stepDayRatio, summarizeStepGoal } from './steps';

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
    const { avgRatio, ...rest } = result;
    // Mean of the capped day shares: (1 + 0.999875 + 0.775) / 3.
    expect(avgRatio).toBeCloseTo(0.92496, 4);
    expect(rest).toEqual({
      today: { steps: 6200, goal: 8000, ratio: 0.775 },
      ratedDays: 3,
      reachedDays: 1,
      // The day with `null` is no 0: averages cover the three days with a value.
      daysWithData: 3,
      avgSteps: 7733,
      avgGoal: 8000,
      avgRatedSteps: 7733,
      latestGoal: 8000,
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
    expect(result).toEqual({
      today: null,
      ratedDays: 1,
      reachedDays: 1,
      daysWithData: 2,
      avgSteps: 6000,
      // Only the day that had a goal is compared with it.
      avgGoal: 5000,
      avgRatedSteps: 6000,
      avgRatio: 1, // 6.000 of 5.000 counts as 100 %
      latestGoal: null,
    });
  });

  it('shows today’s goal without steps as not yet known', () => {
    expect(summarizeStepGoal([], dates, () => 8000)).toEqual({
      today: { steps: null, goal: 8000, ratio: null },
      ratedDays: 0,
      reachedDays: 0,
      daysWithData: 0,
      avgSteps: null,
      avgGoal: null,
      avgRatedSteps: null,
      avgRatio: null,
      latestGoal: 8000,
    });
  });
});

describe('one day against the step goal (Phase 16)', () => {
  it('is proportional and capped at 100 %', () => {
    expect(stepDayRatio(0, 10_000)).toBe(0);
    expect(stepDayRatio(5_000, 10_000)).toBe(0.5);
    expect(stepDayRatio(9_000, 10_000)).toBe(0.9);
    expect(stepDayRatio(10_000, 10_000)).toBe(1);
    expect(stepDayRatio(12_000, 10_000)).toBe(1);
  });

  it('today is proportional as well – no "open" day', () => {
    const summary = summarizeStepGoal([{ date: '2026-10-03', steps: 2_000 }], dates, () => 10_000);
    expect(summary.today).toEqual({ steps: 2_000, goal: 10_000, ratio: 0.2 });
    expect(summary).toMatchObject({ ratedDays: 1, avgRatio: 0.2 });
  });
});
