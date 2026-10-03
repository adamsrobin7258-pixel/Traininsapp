import { NUTRITION } from '@/core/score';
import {
  calorieGoalKind,
  calorieGoalScore,
  calorieGoalStatus,
  nutrientAttainment,
  KCAL_GOAL_TOLERANCE,
  PROTEIN_GOAL_REACHED,
  proteinGoalStatus,
} from './goalAttainment';

describe('calorie goal by main goal (Phase 14)', () => {
  it('shares the one tolerance with the score – no second set of thresholds', () => {
    expect(NUTRITION.kcalTolerance).toBe(KCAL_GOAL_TOLERANCE);
    expect(NUTRITION.proteinReached).toBe(PROTEIN_GOAL_REACHED);
  });

  it('reads the goal as a limit, a minimum or a range', () => {
    expect(calorieGoalKind('lose')).toBe('limit');
    expect(calorieGoalKind('gain')).toBe('minimum');
    expect(calorieGoalKind('maintain')).toBe('range');
    // General fitness is calculated exactly like maintain.
    expect(calorieGoalKind('fitness')).toBe('range');
    expect(calorieGoalKind(null)).toBe('range');
  });

  it('Abnehmen: the goal is an upper limit', () => {
    expect(calorieGoalStatus('lose', 2100, 2200, false)).toBe('within');
    expect(calorieGoalStatus('lose', 2200, 2200, false)).toBe('within');
    expect(calorieGoalStatus('lose', 2201, 2200, false)).toBe('above');
    expect(calorieGoalStatus('lose', 2500, 2200, false)).toBe('above');
    // Far below a limit is still within it – and today as well.
    expect(calorieGoalStatus('lose', 900, 2200, true)).toBe('within');
    expect(calorieGoalStatus('lose', 2500, 2200, true)).toBe('above');
  });

  it('Muskelaufbau: the goal is an amount to reach (from 95 %), more is fine', () => {
    expect(calorieGoalStatus('gain', 2800, 3000, false)).toBe('below');
    expect(calorieGoalStatus('gain', 2850, 3000, false)).toBe('within');
    expect(calorieGoalStatus('gain', 3000, 3000, false)).toBe('within');
    expect(calorieGoalStatus('gain', 3600, 3000, false)).toBe('within');
    // Today is still running: below the goal is open, not a miss.
    expect(calorieGoalStatus('gain', 1200, 3000, true)).toBe('open');
  });

  it.each(['maintain', 'fitness'] as const)('%s: a range of ±5 %% around the goal', (goal) => {
    expect(calorieGoalStatus(goal, 2000, 2300, false)).toBe('below');
    expect(calorieGoalStatus(goal, 2185, 2300, false)).toBe('within');
    expect(calorieGoalStatus(goal, 2300, 2300, false)).toBe('within');
    expect(calorieGoalStatus(goal, 2415, 2300, false)).toBe('within');
    expect(calorieGoalStatus(goal, 2500, 2300, false)).toBe('above');
    expect(calorieGoalStatus(goal, 1000, 2300, true)).toBe('open');
    expect(calorieGoalStatus(goal, 2600, 2300, true)).toBe('above');
  });

  it('has no status without a calorie goal', () => {
    expect(calorieGoalStatus('lose', 2000, null, false)).toBeNull();
    expect(calorieGoalStatus('lose', 2000, 0, false)).toBeNull();
  });
});

describe('protein goal', () => {
  it('is reached from 90 % of the goal; more is never a minus', () => {
    expect(proteinGoalStatus(120, 160, false)).toBe('below');
    expect(proteinGoalStatus(144, 160, false)).toBe('reached');
    expect(proteinGoalStatus(160, 160, false)).toBe('reached');
    expect(proteinGoalStatus(220, 160, false)).toBe('reached');
  });

  it('is open (not missed) today while below the goal', () => {
    expect(proteinGoalStatus(40, 160, true)).toBe('open');
    expect(proteinGoalStatus(150, 160, true)).toBe('reached');
  });

  it('has no status without a protein goal', () => {
    expect(proteinGoalStatus(100, null, false)).toBeNull();
  });
});

describe('calorie points by main goal (Phase 15) – one rule for score and progress card', () => {
  const points = (goal: 'lose' | 'gain' | 'maintain' | 'fitness', ratio: number, target = 2000) =>
    calorieGoalScore(goal, ratio * target, target, false);

  it('Abnehmen: below and at the goal 100, then linear to 0 at +25 %', () => {
    expect(points('lose', 0.8)).toBe(100);
    expect(points('lose', 1)).toBe(100);
    expect(points('lose', 1.05)).toBeCloseTo(80, 5);
    expect(points('lose', 1.1)).toBeCloseTo(60, 5);
    expect(points('lose', 1.2)).toBeCloseTo(20, 5);
    expect(points('lose', 1.25)).toBeCloseTo(0, 5);
    expect(points('lose', 2)).toBe(0);
  });

  it('Muskelaufbau: 0 at 70 %, linear to 100 at 95 %, no bonus above', () => {
    expect(points('gain', 0.7)).toBeCloseTo(0, 5);
    expect(points('gain', 0.75)).toBeCloseTo(20, 5);
    expect(points('gain', 0.85)).toBeCloseTo(60, 5);
    expect(points('gain', 0.95)).toBe(100);
    expect(points('gain', 1)).toBe(100);
    expect(points('gain', 1.3)).toBe(100);
    expect(points('gain', 0.3)).toBe(0);
  });

  it.each(['maintain', 'fitness'] as const)('%s: 95–105 %% → 100, 0 at ±25 %%', (goal) => {
    expect(points(goal, 0.75)).toBeCloseTo(0, 5);
    expect(points(goal, 0.9)).toBeCloseTo(60, 5);
    expect(points(goal, 0.95)).toBe(100);
    expect(points(goal, 1)).toBe(100);
    expect(points(goal, 1.05)).toBe(100);
    expect(points(goal, 1.1)).toBeCloseTo(60, 5);
    expect(points(goal, 1.25)).toBeCloseTo(0, 5);
  });

  it('status and points agree at every edge (no slightly different second rule)', () => {
    const cases = [
      ['lose', 2200, 2200],
      ['lose', 2201, 2200],
      ['gain', 2850, 3000],
      ['gain', 2849, 3000],
      ['maintain', 2375, 2500],
      ['maintain', 2625, 2500],
      ['maintain', 2374, 2500],
      ['fitness', 2626, 2500],
    ] as const;
    for (const [goal, eaten, target] of cases) {
      const status = calorieGoalStatus(goal, eaten, target, false);
      const score = calorieGoalScore(goal, eaten, target, false);
      expect(status === 'within', `${goal} ${eaten}/${target}`).toBe(score === 100);
    }
  });

  it('today: below the goal no points yet (the day is not over), above is judged', () => {
    expect(calorieGoalScore('gain', 2400, 3000, true)).toBeNull();
    expect(calorieGoalScore('lose', 1500, 2200, true)).toBeNull();
    expect(calorieGoalScore('lose', 2420, 2200, true)).toBeCloseTo(60, 5);
    expect(calorieGoalScore('maintain', 2750, 2500, true)).toBeCloseTo(60, 5);
  });

  it('has no points without a calorie goal', () => {
    expect(calorieGoalScore('lose', 2000, null, false)).toBeNull();
    expect(calorieGoalScore('gain', 2000, 0, false)).toBeNull();
  });
});

describe('protein against its goal (unchanged threshold 90 %)', () => {
  it('<90 % below, 90 % and 100 % reached, missing goal → none', () => {
    expect(proteinGoalStatus(143, 160, false)).toBe('below');
    expect(proteinGoalStatus(144, 160, false)).toBe('reached');
    expect(proteinGoalStatus(160, 160, false)).toBe('reached');
    expect(proteinGoalStatus(160, null, false)).toBeNull();
  });
});

describe('carbohydrates and fat – simple attainment, at most 100 %', () => {
  it('0 %, part of the goal, 100 % and more than the goal (no bonus)', () => {
    expect(nutrientAttainment(0, 250)).toEqual({ actual: 0, target: 250, ratio: 0, percent: 0 });
    expect(nutrientAttainment(180, 250)).toMatchObject({ ratio: 0.72, percent: 72 });
    expect(nutrientAttainment(65, 80)).toMatchObject({ percent: 81 });
    expect(nutrientAttainment(250, 250)).toMatchObject({ ratio: 1, percent: 100 });
    expect(nutrientAttainment(320, 250)).toMatchObject({ actual: 320, ratio: 1, percent: 100 });
  });

  it('has none without a target', () => {
    expect(nutrientAttainment(180, null)).toBeNull();
    expect(nutrientAttainment(180, 0)).toBeNull();
  });
});
