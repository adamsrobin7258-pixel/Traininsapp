import { NUTRITION } from '@/core/score';
import {
  calorieGoalKind,
  calorieGoalStatus,
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
