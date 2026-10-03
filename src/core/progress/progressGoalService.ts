import type { ActivityPeriodSummary, StepDay, StepGoalSummary, WeightDay } from '@/core/health';
import { summarizeStepGoal, summarizeWeightPeriod, type WeightPeriodSummary } from '@/core/health';
import type { NutritionDayGoal, NutritionDayTotals } from '@/core/nutrition';
import { targetOn, type TargetHistory } from '@/core/targets';
import {
  summarizeTraining,
  type TrainingDayStats,
  type TrainingPeriodSummary,
} from '@/core/training';
import {
  activityGoalProgress,
  stepGoalProgress,
  type Attainment,
  nutritionGoalProgress,
  trainingGoalProgress,
  type ActivityGoalProgress,
  type NutritionGoalProgress,
  type TrainingGoalProgress,
} from './goalProgress';

/**
 * Where the progress page reads its data – the existing services, wired in app/services.ts with
 * the very same functions the score uses (workouts, countable activity minutes, nutrition
 * totals and day goals, versioned targets). Every source covers the local days `from`…`to`.
 */
export interface ProgressSources {
  /** Completed Kalethra workouts and volume per day (WorkoutService.dailyStatsBetween). */
  workoutsPerDay(profileId: string, from: string, to: string): Promise<TrainingDayStats[]>;
  /** Countable active minutes per day – the score's source (countableActivityMinutes). */
  activityMinutesPerDay(
    profileId: string,
    from: string,
    to: string,
  ): Promise<{ localDate: string; minutes: number }[]>;
  /** Count, duration and active kcal of both activity sources (summarizeAllActivities). */
  activitySummary(profileId: string, dates: readonly string[]): Promise<ActivityPeriodSummary>;
  /** Days with at least one food entry (DiaryService.dailyTotalsBetween). */
  nutritionTotals(profileId: string, from: string, to: string): Promise<NutritionDayTotals[]>;
  /** Day goals as the diary shows them, with the main goal of each day (dayGoalsBetween). */
  nutritionGoals(profileId: string, dates: readonly string[]): Promise<NutritionDayGoal[]>;
  /** Daily steps from Health Connect only; days without a value are missing or `null`. */
  steps(profileId: string, from: string, to: string): Promise<StepDay[]>;
  /**
   * Weight for display (weight rule 2: own entry wins, Health Connect secondary), ascending –
   * the values of the period plus the latest one before it.
   */
  weights(profileId: string, from: string, to: string): Promise<WeightDay[]>;
  /** Versioned targets (TargetService); each day is judged by its own version. */
  targets(profileId: string): Promise<TargetHistory>;
}

export interface ProgressGoals {
  training: { summary: TrainingPeriodSummary; goal: TrainingGoalProgress };
  activity: { summary: ActivityPeriodSummary; goal: ActivityGoalProgress };
  /** Real steps against the step goal (the score's activity area reads countable steps). */
  steps: { summary: StepGoalSummary; attainment: Attainment | null };
  nutrition: NutritionGoalProgress;
  /** Pure development of the weight; there is no target weight. */
  weight: WeightPeriodSummary;
}

/** Goal attainment of a period: goals from Einstellungen against the tracked values. */
export class ProgressGoalService {
  constructor(private readonly sources: ProgressSources) {}

  async calculate(
    profileId: string,
    dates: readonly string[],
    options: { today: string },
  ): Promise<ProgressGoals> {
    const from = dates[0];
    const to = dates.at(-1);
    if (!from || !to) throw new Error('Progress needs at least one day');
    const s = this.sources;
    const [workouts, minutes, activity, totals, goals, steps, weights, targets] = await Promise.all(
      [
        s.workoutsPerDay(profileId, from, to),
        s.activityMinutesPerDay(profileId, from, to),
        s.activitySummary(profileId, dates),
        s.nutritionTotals(profileId, from, to),
        s.nutritionGoals(profileId, dates),
        s.steps(profileId, from, to),
        s.weights(profileId, from, to),
        s.targets(profileId),
      ],
    );
    return {
      training: {
        summary: summarizeTraining(workouts, dates),
        goal: trainingGoalProgress(workouts, dates, (date) =>
          targetOn(targets.trainingsPerWeek, date),
        ),
      },
      activity: {
        summary: activity,
        goal: activityGoalProgress(minutes, dates, (date) =>
          targetOn(targets.activeMinutesPerWeek, date),
        ),
      },
      steps: stepGoalProgress(
        summarizeStepGoal(steps, dates, (date) => targetOn(targets.stepsPerDay, date)),
      ),
      nutrition: nutritionGoalProgress(totals, goals, dates, options.today),
      weight: summarizeWeightPeriod(weights, from, to),
    };
  }
}
