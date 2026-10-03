import type { GoalType, NutritionDayGoal, NutritionDayTotals } from '@/core/nutrition';
import { targetOn, type TargetHistory } from '@/core/targets';
import {
  calculateScore,
  scoreTrend,
  type ScoreRecoveryDay,
  type ScoreResult,
  type ScoreTrend,
} from './score';

/**
 * Where the score reads its data – the existing services, never a copy (wired in
 * app/services.ts). Every source covers the local days `from`…`to` (inclusive).
 */
export interface ScoreSources {
  /** Main goal (goal type of the nutrition profile) in force on a day. */
  goalTypeOn(profileId: string, localDate: string): Promise<GoalType | null>;
  /** Days with at least one food entry and their totals (DiaryService). */
  nutritionTotals(profileId: string, from: string, to: string): Promise<NutritionDayTotals[]>;
  /**
   * Day goals exactly as the diary shows them (GoalService.dayGoalsBetween) – with activity
   * calories only on days "Aktivitätskalorien anrechnen" was on then.
   */
  nutritionGoals(profileId: string, dates: readonly string[]): Promise<NutritionDayGoal[]>;
  /** Completed Kalethra workouts per day (WorkoutService.dailyStatsBetween). */
  workoutsPerDay(
    profileId: string,
    from: string,
    to: string,
  ): Promise<{ localDate: string; workouts: number }[]>;
  /** Countable active minutes per day (manual + Health Connect, see countableActivityMinutes). */
  activityMinutesPerDay(
    profileId: string,
    from: string,
    to: string,
  ): Promise<{ localDate: string; minutes: number }[]>;
  recovery(profileId: string, from: string, to: string): Promise<ScoreRecoveryDay[]>;
  /** Versioned weekly targets (TargetService); each day is judged by its own version. */
  targets(profileId: string): Promise<TargetHistory>;
}

export interface ScoreOptions {
  /** Today's local day. */
  today: string;
}

export interface ScoreWithTrend {
  current: ScoreResult;
  previous: ScoreResult;
  trend: ScoreTrend;
  delta: number | null;
}

/** Calculates the score of a period from the existing data. Nothing is stored. */
export class ScoreService {
  constructor(private readonly sources: ScoreSources) {}

  async calculate(
    profileId: string,
    dates: readonly string[],
    options: ScoreOptions,
  ): Promise<ScoreResult> {
    const from = dates[0];
    const to = dates.at(-1);
    if (!from || !to) throw new Error('A score needs at least one day');
    const s = this.sources;
    const [goal, totals, goals, workouts, minutes, recovery, targets] = await Promise.all([
      s.goalTypeOn(profileId, to),
      s.nutritionTotals(profileId, from, to),
      s.nutritionGoals(profileId, dates),
      s.workoutsPerDay(profileId, from, to),
      s.activityMinutesPerDay(profileId, from, to),
      s.recovery(profileId, from, to),
      s.targets(profileId),
    ]);
    return calculateScore({
      goal,
      dates,
      today: options.today,
      nutrition: { totals, goals },
      training: { workoutsPerDay: workouts },
      activity: { minutesPerDay: minutes },
      recovery,
      targets: {
        trainingsPerWeek: (date) => targetOn(targets.trainingsPerWeek, date),
        activeMinutesPerWeek: (date) => targetOn(targets.activeMinutesPerWeek, date),
      },
    });
  }

  /** The period and the one right before it (same length), with the trend between them. */
  async withTrend(
    profileId: string,
    dates: readonly string[],
    previousDates: readonly string[],
    options: ScoreOptions,
  ): Promise<ScoreWithTrend> {
    const [current, previous] = await Promise.all([
      this.calculate(profileId, dates, options),
      this.calculate(profileId, previousDates, options),
    ]);
    return { current, previous, ...scoreTrend(current, previous, dates.length) };
  }
}
