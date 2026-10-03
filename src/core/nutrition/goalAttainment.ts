/**
 * Whether a day's calories and protein meet the day goal – the one definition the progress page
 * and the score share (Phase 14). Pure.
 *
 * The thresholds are the existing ones of the Kalethra score (Phase 9), moved here so that no
 * second set of tolerances exists:
 * - `KCAL_GOAL_TOLERANCE`: up to ±5 % from the calorie goal counts as "on the goal".
 * - `PROTEIN_GOAL_REACHED`: protein from 90 % of the goal counts as reached; more is never a minus.
 *
 * What "meeting" the calorie goal means depends on the main goal:
 * - lose: the goal is an upper limit – at or below it is kept, above it is over.
 * - gain: the goal is an amount to reach – from 95 % on it is reached, more is fine.
 * - maintain and fitness (calculated exactly like maintain): a range of ±5 % around the goal.
 *
 * Today is still running: falling short of a goal is not judged yet (`open`) – the same rule as
 * in the score. Being over a limit is judged today too.
 */
import type { GoalType } from './goals';

export const KCAL_GOAL_TOLERANCE = 0.05;
export const PROTEIN_GOAL_REACHED = 0.9;

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
      status = deviation >= -KCAL_GOAL_TOLERANCE ? 'within' : 'below';
      break;
    case 'range':
      status =
        deviation > KCAL_GOAL_TOLERANCE
          ? 'above'
          : deviation < -KCAL_GOAL_TOLERANCE
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
