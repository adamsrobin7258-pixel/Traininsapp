/**
 * The day calendar of the progress page (Phase 23): per local day, whether a Kalethra workout was
 * completed and whether the calorie goal was met. Pure – no new rule of its own:
 * - training: the completed workouts per day (`WorkoutService.dailyStatsBetween`, status
 *   `completed` only – started, discarded or planned workouts are not in it);
 * - calories: `calorieGoalStatus` by the day's main goal (the progress page's and the score's
 *   definition), and today below the goal is not judged yet – the rule `calorieGoalScore` applies.
 * Missing data stays missing: a day without entries or without a goal is never "not reached".
 */
import {
  calorieGoalScore,
  calorieGoalStatus,
  type NutritionDayGoal,
  type NutritionDayTotals,
} from '@/core/nutrition';
import type { TrainingDayStats } from '@/core/training';

/**
 * - `reached`: the goal was met (the only state the calendar marks);
 * - `notReached`: entries and a goal exist, the goal was not met (shown neutrally, never red);
 * - `open`: today, not judged yet;
 * - `noGoal`: entries but no calorie goal that day;
 * - `noData`: no food entry that day.
 */
export type CalendarCalorieState = 'reached' | 'notReached' | 'open' | 'noGoal' | 'noData';

export interface ProgressCalendarDay {
  /** Local day, YYYY-MM-DD. */
  date: string;
  /** Completed Kalethra workouts that day; several give one mark, the number is for the details. */
  workouts: number;
  calories: CalendarCalorieState;
}

function calorieState(
  totals: NutritionDayTotals | undefined,
  goal: NutritionDayGoal | undefined,
  isToday: boolean,
): CalendarCalorieState {
  if (!totals) return 'noData';
  const goalType = goal?.goalType ?? null;
  const goalKcal = goal?.energyKcal ?? null;
  const status = calorieGoalStatus(goalType, totals.energyKcal, goalKcal, isToday);
  if (status === null) return 'noGoal';
  // Today below the goal is still running – neither reached nor missed (the score's rule).
  if (calorieGoalScore(goalType, totals.energyKcal, goalKcal, isToday) === null) return 'open';
  return status === 'within' ? 'reached' : 'notReached';
}

/** One entry per day of `dates`, in the same order. */
export function progressCalendar(
  workouts: readonly TrainingDayStats[],
  totals: readonly NutritionDayTotals[],
  goals: readonly NutritionDayGoal[],
  dates: readonly string[],
  today: string,
): ProgressCalendarDay[] {
  const workoutsByDate = new Map(workouts.map((day) => [day.localDate, day.workouts]));
  const totalsByDate = new Map(totals.map((day) => [day.localDate, day]));
  const goalByDate = new Map(goals.map((goal) => [goal.localDate, goal]));
  return dates.map((date) => ({
    date,
    workouts: Math.max(0, workoutsByDate.get(date) ?? 0),
    calories: calorieState(totalsByDate.get(date), goalByDate.get(date), date === today),
  }));
}
