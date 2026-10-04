/**
 * Product configuration of the Kalethra score. Pure.
 *
 * The weights and thresholds are product decisions, not a validated scientific or medical
 * formula. They are kept here, in one place, so they can be tuned without touching the
 * calculation (see docs/SCORE.md).
 */
import { KCAL_GOAL_TOLERANCE, PROTEIN_GOAL_REACHED, type GoalType } from '@/core/nutrition';
import type { RecoveryState } from '@/core/recovery';

export const SCORE_AREAS = ['nutrition', 'training', 'activity', 'recovery'] as const;
export type ScoreArea = (typeof SCORE_AREAS)[number];

/** The user's main goal as the score sees it – the goal type of the nutrition profile. */
export type ScoreGoal = GoalType;

/** Share of each area per main goal; each row adds up to 1. */
export const SCORE_WEIGHTS: Record<ScoreGoal, Record<ScoreArea, number>> = {
  lose: { nutrition: 0.45, training: 0.25, activity: 0.2, recovery: 0.1 },
  gain: { nutrition: 0.3, training: 0.45, activity: 0.1, recovery: 0.15 },
  maintain: { nutrition: 0.4, training: 0.25, activity: 0.25, recovery: 0.1 },
  fitness: { nutrition: 0.3, training: 0.3, activity: 0.25, recovery: 0.15 },
};

/** Without a nutrition profile the score weighs the areas like "general fitness". */
export const DEFAULT_SCORE_GOAL: ScoreGoal = 'fitness';

export const NUTRITION = {
  /** Share of calories and protein in a day's nutrition value (when both goals exist). */
  kcalShare: 0.7,
  proteinShare: 0.3,
  /**
   * The calorie points of a day depend on the main goal (lose = upper limit, gain = from 95 %,
   * maintain/fitness = ±5 %) – one rule for score and progress card, kept with its thresholds in
   * core/nutrition/goalAttainment.ts (`calorieGoalScore`). This is the ±5 % range shared there.
   */
  kcalTolerance: KCAL_GOAL_TOLERANCE,
  /** Protein from 90 % of the goal on counts as reached; more is never a penalty … */
  proteinReached: PROTEIN_GOAL_REACHED,
  /** … below it, 2 points per missing percent (80 % → 80, 70 % → 60, 50 % → 20). */
  proteinPointsPerPercent: 2,
  /**
   * The running day (Phase 17.5): what is expected so far is the day goal × the share of the
   * day already past, widened by about one meal in both directions (this many shares of the
   * goal), because food comes in meals, not evenly. Inside this corridor the day is on track
   * (100); outside it the usual rule of the main goal applies against the crossed edge. The
   * corridor also keeps the value stable right after midnight (a snack at 00:30 is no excess).
   */
  runningDayAllowance: 0.25,
} as const;

/** Self-reported recovery of a day → points. Subjective, never a medical judgement. */
export const RECOVERY_POINTS: Record<RecoveryState, number> = { good: 100, moderate: 60, poor: 20 };

/**
 * "Vorläufig": the score is shown, but marked, when
 * - fewer than half of the period's days carry any own entry, or
 * - fewer than two of the four areas could be rated.
 */
export const PRELIMINARY = { documentedShare: 0.5, minRatedAreas: 2 } as const;

/** A change of less than this many points counts as "about the same". */
export const TREND_THRESHOLD = 3;

/** Wording bands of the total, lowest first. */
export const SCORE_BANDS = [
  { min: 0, band: 'low' },
  { min: 50, band: 'partial' },
  { min: 70, band: 'good' },
  { min: 85, band: 'excellent' },
] as const;
export type ScoreBand = (typeof SCORE_BANDS)[number]['band'];

/** Options offered for the two weekly targets (`null` = no target). */
export const TRAININGS_PER_WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
export const ACTIVE_MINUTES_PER_WEEK_OPTIONS = [60, 90, 120, 150, 180, 240, 300] as const;
