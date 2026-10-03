import {
  activityGoalProgress,
  attainment,
  nutritionGoalProgress,
  stepGoalProgress,
  trainingGoalProgress,
} from './goalProgress';
import { summarizeStepGoal } from '@/core/health';
import type { NutritionDayGoal } from '@/core/nutrition';
import { toLocalDateKey } from '@/shared/lib/date';

const TODAY = '2026-10-03';
const WEEK = [
  '2026-09-27',
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
];
const workouts = (...days: string[]) => days.map((localDate) => ({ localDate, workouts: 1 }));

describe('attainment', () => {
  it('keeps the real value and caps only the bar at 100 %', () => {
    expect(attainment(3, 4)).toEqual({
      actual: 3,
      target: 4,
      ratio: 0.75,
      shownRatio: 0.75,
      percent: 75,
    });
    expect(attainment(5, 4)).toMatchObject({ actual: 5, target: 4, shownRatio: 1, percent: 125 });
    expect(attainment(999_999, 10_000)).toMatchObject({ shownRatio: 1, percent: 10_000 });
    expect(attainment(0, 4)).toMatchObject({ shownRatio: 0, percent: 0 });
  });

  it('has none without a target', () => {
    expect(attainment(3, 0)).toBeNull();
  });
});

describe('training goal', () => {
  it('target 4, 3 done → 3 of 4', () => {
    const goal = trainingGoalProgress(workouts(WEEK[1]!, WEEK[3]!, WEEK[5]!), WEEK, 4);
    expect(goal).toMatchObject({ mode: 'full', done: 3, expected: 4, weeklyTarget: 4 });
    expect(goal.mode === 'full' && goal.attainment.percent).toBe(75);
  });

  it('4 done → 4 of 4', () => {
    const goal = trainingGoalProgress(workouts(...WEEK.slice(0, 4)), WEEK, 4);
    expect(goal.mode === 'full' && goal.attainment).toMatchObject({ ratio: 1, shownRatio: 1 });
  });

  it('5 done → the real 5 stays visible, the bar stops at 100 %', () => {
    const goal = trainingGoalProgress(workouts(...WEEK.slice(0, 5)), WEEK, 4);
    expect(goal).toMatchObject({ mode: 'full', done: 5, expected: 4 });
    expect(goal.mode === 'full' && goal.attainment).toMatchObject({
      shownRatio: 1,
      percent: 125,
    });
  });

  it('no workout in a full week with a target → 0 of 4 (a fact, workouts are always tracked)', () => {
    expect(trainingGoalProgress([], WEEK, 4)).toMatchObject({ mode: 'full', done: 0 });
  });

  it('today: no fair weekly expectation – no ratio, no artificial 0 %', () => {
    expect(trainingGoalProgress([], [TODAY], 4)).toEqual({
      mode: 'short',
      done: 0,
      weeklyTarget: 4,
    });
    expect(trainingGoalProgress(workouts(TODAY), [TODAY], 4)).toMatchObject({
      mode: 'short',
      done: 1,
    });
  });

  it('without a target only the workouts', () => {
    expect(trainingGoalProgress(workouts(TODAY), WEEK, null)).toEqual({ mode: 'none', done: 1 });
  });

  it('versioned: 3/week until Wednesday, 4/week from Thursday – no retroactive 4', () => {
    // 27.09.–30.09. (4 days) target 3, 01.10.–03.10. (3 days) target 4 → 12/7 + 12/7 = 3.4.
    const target = (date: string) => (date < '2026-10-01' ? 3 : 4);
    const goal = trainingGoalProgress(workouts(WEEK[0]!, WEEK[4]!), WEEK, target);
    expect(goal).toMatchObject({ mode: 'full', done: 2, expected: 3.4, weeklyTarget: 4 });
    // With the new target for every day it would have been 4.
    expect(trainingGoalProgress(workouts(WEEK[0]!, WEEK[4]!), WEEK, 4)).toMatchObject({
      expected: 4,
    });
  });

  it('a target set only recently covers part of the period and says since when', () => {
    const month = Array.from({ length: 30 }, (_, i) => toLocalDateKey(new Date(2026, 8, 4 + i)));
    const target = (date: string) => (date >= '2026-09-20' ? 3 : null);
    // A workout before the target existed does not count against it.
    const goal = trainingGoalProgress(workouts('2026-09-10', '2026-09-25'), month, target);
    expect(goal).toMatchObject({
      mode: 'full',
      done: 1,
      targetSince: '2026-09-20',
      expected: 6, // 20.09.–03.10.: 14 days × 3 ÷ 7
    });
  });
});

describe('activity goal', () => {
  const minutes = (entries: [string, number][]) =>
    entries.map(([localDate, value]) => ({ localDate, minutes: value }));

  it('135 of 180 active minutes', () => {
    const goal = activityGoalProgress(
      minutes([
        ['2026-09-28', 60],
        ['2026-10-01', 75],
      ]),
      WEEK,
      180,
    );
    expect(goal).toMatchObject({ mode: 'full', minutes: 135, expectedMinutes: 180 });
    expect(goal.mode === 'full' && goal.attainment.percent).toBe(75);
  });

  it('a target without any activity is neutral – not tracked is not inactive', () => {
    expect(activityGoalProgress([], WEEK, 180)).toEqual({
      mode: 'noData',
      weeklyTarget: 180,
      expectedMinutes: 180,
      targetSince: null,
    });
  });

  it('today: the day share of the weekly target, like the score', () => {
    expect(activityGoalProgress(minutes([[TODAY, 30]]), [TODAY], 210)).toMatchObject({
      mode: 'full',
      minutes: 30,
      expectedMinutes: 30,
    });
  });

  it('without a target only the minutes', () => {
    expect(activityGoalProgress(minutes([[TODAY, 30]]), WEEK, null)).toEqual({
      mode: 'none',
      minutes: 30,
    });
  });
});

describe('steps goal', () => {
  it('compares the days with data only – missing days are not 0', () => {
    const summary = summarizeStepGoal(
      [
        { date: '2026-09-28', steps: 12_000 },
        { date: '2026-10-01', steps: 6_000 },
        { date: '2026-10-02', steps: null },
      ],
      WEEK,
      () => 10_000,
    );
    const { attainment: value } = stepGoalProgress(summary);
    expect(summary).toMatchObject({ daysWithData: 2, avgSteps: 9_000, reachedDays: 1 });
    // (12.000 + 6.000) / 2 = 9.000 of 10.000 – not 18.000 / 7.
    expect(value).toMatchObject({ actual: 9_000, target: 10_000, percent: 90 });
  });

  it('has no ratio without step data or without a goal', () => {
    expect(stepGoalProgress(summarizeStepGoal([], WEEK, () => 10_000)).attainment).toBeNull();
    expect(
      stepGoalProgress(summarizeStepGoal([{ date: TODAY, steps: 7842 }], WEEK, () => null))
        .attainment,
    ).toBeNull();
  });
});

describe('nutrition goal', () => {
  const goals = (
    goalType: NutritionDayGoal['goalType'],
    energyKcal: number | null = 2200,
    proteinG: number | null = 160,
  ): NutritionDayGoal[] => WEEK.map((localDate) => ({ localDate, energyKcal, proteinG, goalType }));
  const day = (localDate: string, energyKcal: number, proteinG = 160) => ({
    localDate,
    energyKcal,
    proteinG,
  });

  it('Abnehmen: below, on and over the limit; days without entries do not count', () => {
    const result = nutritionGoalProgress(
      [day('2026-09-28', 2100), day('2026-09-29', 2200), day('2026-09-30', 2500)],
      goals('lose'),
      WEEK,
      TODAY,
    );
    expect(result.calories).toMatchObject({
      kind: 'limit',
      avgKcal: 2267,
      avgGoalKcal: 2200,
      ratedDays: 3,
      withinDays: 2,
      aboveDays: 1,
      belowDays: 0,
      today: null,
    });
    expect(result.summary.loggedDays).toBe(3);
  });

  it('Muskelaufbau: below the goal is a miss on past days, open today', () => {
    const result = nutritionGoalProgress(
      [day('2026-10-01', 2600), day('2026-10-02', 3100), day(TODAY, 1200)],
      goals('gain', 3000),
      WEEK,
      TODAY,
    );
    expect(result.calories).toMatchObject({
      kind: 'minimum',
      ratedDays: 2,
      withinDays: 1,
      belowDays: 1,
      today: 'open',
    });
  });

  it.each(['maintain', 'fitness'] as const)('%s: within the range, above and below', (type) => {
    const result = nutritionGoalProgress(
      [day('2026-10-01', 2000), day('2026-10-02', 2250), day(TODAY, 2700)],
      goals(type),
      WEEK,
      TODAY,
    );
    expect(result.calories).toMatchObject({
      kind: 'range',
      ratedDays: 3,
      withinDays: 1,
      belowDays: 1,
      aboveDays: 1,
      today: 'above',
    });
  });

  it('protein below, on and above the goal', () => {
    const result = nutritionGoalProgress(
      [day('2026-09-30', 2200, 100), day('2026-10-01', 2200, 160), day('2026-10-02', 2200, 220)],
      goals('maintain'),
      WEEK,
      TODAY,
    );
    expect(result.protein).toMatchObject({
      avgG: 160,
      avgGoalG: 160,
      ratedDays: 3,
      reachedDays: 2,
      today: null,
    });
    expect(result.protein?.attainment).toMatchObject({ percent: 100, shownRatio: 1 });
  });

  it('uses a manual protein goal as given (no new calculation)', () => {
    const result = nutritionGoalProgress(
      [day('2026-10-02', 2200, 142)],
      goals('lose', 2200, 220),
      WEEK,
      TODAY,
    );
    expect(result.protein).toMatchObject({ avgG: 142, avgGoalG: 220, reachedDays: 0 });
  });

  it('a week without any entry is no 0 kcal: no calorie or protein figures at all', () => {
    const result = nutritionGoalProgress([], goals('lose'), WEEK, TODAY);
    expect(result.calories).toBeNull();
    expect(result.protein).toBeNull();
    expect(result.summary.loggedDays).toBe(0);
  });

  it('versioned goals: each day keeps the goal and main goal it had', () => {
    const versioned: NutritionDayGoal[] = WEEK.map((localDate) =>
      localDate < '2026-10-01'
        ? { localDate, energyKcal: 2000, proteinG: 150, goalType: 'lose' }
        : { localDate, energyKcal: 2600, proteinG: 170, goalType: 'gain' },
    );
    const result = nutritionGoalProgress(
      // 2.100 is over the old limit (lose); 2.500 reaches the new goal (gain, ≥ 95 %).
      [day('2026-09-29', 2100, 150), day('2026-10-02', 2500, 170)],
      versioned,
      WEEK,
      TODAY,
    );
    expect(result.calories).toMatchObject({
      kind: 'minimum', // main goal on the last day
      avgGoalKcal: 2300,
      ratedDays: 2,
      withinDays: 1,
      aboveDays: 1,
    });
  });

  it('without a calorie goal there is no calorie attainment', () => {
    const result = nutritionGoalProgress([day(TODAY, 1800)], goals(null, null, null), WEEK, TODAY);
    expect(result.calories).toBeNull();
    expect(result.protein).toBeNull();
    expect(result.summary.avgKcal).toBe(1800);
  });
});
