/**
 * Whether a day's calories and protein meet the day goal – the one definition the progress page
 * and the score share (Phase 14, calorie points by main goal since Phase 15). Pure.
 *
 * Calories – what "meeting" the goal means and how many points a day gets depends on the main
 * goal of that day:
 * - lose: the goal is an upper limit. At or below it → 100; above it the points fall linearly to
 *   0 at +25 % (+5 % → 80, +10 % → 60, +20 % → 20).
 * - gain: the goal is an amount to reach. From 95 % on → 100 (more is no bonus and no minus);
 *   below it the points fall linearly to 0 at 70 % (75 % → 20, 85 % → 60).
 * - maintain and fitness (calculated exactly like maintain): 95–105 % → 100; outside the range
 *   linear and continuous from 100 at the edge to 0 at ±25 % (94 % → 95, 90 % → 75, 80 % → 25).
 * Protein from 90 % of the goal counts as reached; more is never a minus.
 *
 * Today is still running: falling short of the goal is not judged yet (status `open`, no points)
 * – the same rule as before. Being over a goal is judged today too.
 */
import { goalProgress, type GoalType } from './goals';

/** ±5 %: the range of maintain/fitness, and gain counts as reached from 95 %. */
export const KCAL_GOAL_TOLERANCE = 0.05;
/** lose and maintain/fitness: 0 points at 25 % from the goal. */
export const KCAL_ZERO_DEVIATION = 0.25;
/** gain: 0 points at 70 % of the goal. */
export const KCAL_GAIN_ZERO_RATIO = 0.7;
export const PROTEIN_GOAL_REACHED = 0.9;

/** Floating point slack for the range edges (2.375 of 2.500 kcal is exactly −5 %). */
const EDGE = 1e-9;

/** `within` = goal kept / reached / in range; `open` = today and not reached yet (neutral). */
export type CalorieGoalStatus = 'within' | 'below' | 'above' | 'open';
export type ProteinGoalStatus = 'reached' | 'below' | 'open';

/** How the calorie goal of a main goal is read: a limit, an amount to reach, or a range. */
export type CalorieGoalKind = 'limit' | 'minimum' | 'range';

export function calorieGoalKind(goalType: GoalType | null): CalorieGoalKind {
  if (goalType === 'lose') return 'limit';
  if (goalType === 'gain') return 'minimum';
  // maintain and fitness; without a goal type the calculation behaves like maintain as well.
  return 'range';
}

/** One day's calories against its goal; `null` when the day has no calorie goal. */
export function calorieGoalStatus(
  goalType: GoalType | null,
  eatenKcal: number,
  goalKcal: number | null,
  isToday: boolean,
): CalorieGoalStatus | null {
  if (goalKcal === null || goalKcal <= 0) return null;
  const deviation = (eatenKcal - goalKcal) / goalKcal;
  let status: Exclude<CalorieGoalStatus, 'open'>;
  switch (calorieGoalKind(goalType)) {
    case 'limit':
      status = eatenKcal <= goalKcal ? 'within' : 'above';
      break;
    case 'minimum':
      status = deviation >= -KCAL_GOAL_TOLERANCE - EDGE ? 'within' : 'below';
      break;
    case 'range':
      status =
        deviation > KCAL_GOAL_TOLERANCE + EDGE
          ? 'above'
          : deviation < -KCAL_GOAL_TOLERANCE - EDGE
            ? 'below'
            : 'within';
  }
  return isToday && status === 'below' ? 'open' : status;
}

/** One day's protein against its goal; `null` when the day has no protein goal. */
export function proteinGoalStatus(
  eatenG: number,
  goalG: number | null,
  isToday: boolean,
): ProteinGoalStatus | null {
  if (goalG === null || goalG <= 0) return null;
  if (eatenG / goalG >= PROTEIN_GOAL_REACHED) return 'reached';
  return isToday ? 'open' : 'below';
}

const clamp100 = (value: number) => Math.min(100, Math.max(0, value));

/**
 * The points (0–100) of one day's calories against its goal, by the day's main goal (see the
 * rules above). `null` when the day has no calorie goal, or today while below the goal (not
 * judged yet). Not rounded – the score rounds its area values.
 */
export function calorieGoalScore(
  goalType: GoalType | null,
  eatenKcal: number,
  goalKcal: number | null,
  isToday: boolean,
): number | null {
  if (goalKcal === null || goalKcal <= 0) return null;
  if (isToday && eatenKcal < goalKcal) return null;
  const ratio = eatenKcal / goalKcal;
  const deviation = ratio - 1;
  switch (calorieGoalKind(goalType)) {
    case 'limit':
      return deviation <= 0 ? 100 : clamp100(100 - (deviation / KCAL_ZERO_DEVIATION) * 100);
    case 'minimum': {
      const reached = 1 - KCAL_GOAL_TOLERANCE;
      if (ratio >= reached - EDGE) return 100;
      return clamp100(((ratio - KCAL_GAIN_ZERO_RATIO) / (reached - KCAL_GAIN_ZERO_RATIO)) * 100);
    }
    case 'range':
      // Continuous: 100 at the edge of the range (±5 %), 0 at ±25 %.
      return Math.abs(deviation) <= KCAL_GOAL_TOLERANCE + EDGE
        ? 100
        : clamp100(
            100 -
              ((Math.abs(deviation) - KCAL_GOAL_TOLERANCE) /
                (KCAL_ZERO_DEVIATION - KCAL_GOAL_TOLERANCE)) *
                100,
          );
  }
}

/** Actual against target of a nutrient (e.g. carbohydrates, fat): no bonus beyond 100 %. */
export interface NutrientAttainment {
  actual: number;
  target: number;
  /** 0…1 – never more than the target. */
  ratio: number;
  /** Whole percent, at most 100. */
  percent: number;
}

/**
 * Simple goal attainment of a nutrient – the eaten amount against its target, capped at 100 %
 * (built on `goalProgress`, the diary's meter). `null` without a target; missing data are not
 * passed in (an unlogged day is no 0 g).
 */
export function nutrientAttainment(
  actual: number,
  target: number | null,
): NutrientAttainment | null {
  if (target === null || target <= 0 || !Number.isFinite(actual)) return null;
  const { ratio } = goalProgress(actual, target);
  return { actual, target, ratio, percent: Math.round(ratio * 100) };
}
