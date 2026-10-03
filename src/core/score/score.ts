/**
 * The Kalethra score: how well the documented data of a period meets the user's own goals.
 * Pure and deterministic – the same input always gives the same result; nothing is stored.
 *
 * Four areas, each 0–100 or `null` (= not rateable, treated as neutral): nutrition, training,
 * activity, recovery. The total is the weighted mean of the rated areas with the weights of the
 * main goal, renormalised over those areas – a missing area neither adds nor costs points.
 * It describes goal achievement inside Kalethra only; it is no health or medical rating.
 */
import type { NutritionDayGoal, NutritionDayTotals } from '@/core/nutrition';
import type { RecoveryState } from '@/core/recovery';
import { weeklyExpectation as expectation, type TargetValue } from '@/core/targets';
import {
  DEFAULT_SCORE_GOAL,
  NUTRITION,
  PRELIMINARY,
  RECOVERY_POINTS,
  SCORE_AREAS,
  SCORE_BANDS,
  SCORE_WEIGHTS,
  TREND_THRESHOLD,
  type ScoreArea,
  type ScoreBand,
  type ScoreGoal,
} from './config';

export type { TargetValue } from '@/core/targets';

export interface ScoreRecoveryDay {
  localDate: string;
  /** Self-reported; `null` when only a rest day was marked. */
  state: RecoveryState | null;
  restDay: boolean;
}

export interface ScoreInput {
  /** Main goal in force at the end of the period; `null` without a nutrition profile. */
  goal: ScoreGoal | null;
  /** Every local day of the period, oldest first. */
  dates: readonly string[];
  /** Today's local day – today is still running, so falling short of a goal is not judged yet. */
  today: string;
  nutrition: { totals: readonly NutritionDayTotals[]; goals: readonly NutritionDayGoal[] };
  /** Completed Kalethra workouts per day; Health Connect and manual activities never count. */
  training: { workoutsPerDay: readonly { localDate: string; workouts: number }[] };
  /** Countable activity minutes per day (both sources, duplicates once, no Kalethra workouts). */
  activity: { minutesPerDay: readonly { localDate: string; minutes: number }[] };
  recovery: readonly ScoreRecoveryDay[];
  /**
   * Weekly targets – one value for the whole period, or the value in force on each day
   * (versioned targets: a past day keeps the target that applied then).
   */
  targets: { trainingsPerWeek: TargetValue; activeMinutesPerWeek: TargetValue };
}

export interface NutritionDetail {
  loggedDays: number;
  ratedDays: number;
  /** Mean calorie deviation of the rated days in percent (+ over, − under); `null` without. */
  avgKcalDeviationPct: number | null;
  proteinRatedDays: number;
  proteinReachedDays: number;
}

export interface TrainingDetail {
  target: number | null;
  done: number;
  /** Expected sessions in the period (target × days ÷ 7), one decimal; `null` without target. */
  expected: number | null;
  restDays: number;
}

export interface ActivityDetail {
  target: number | null;
  minutes: number;
  expectedMinutes: number | null;
  activeDays: number;
}

export interface RecoveryDetail {
  entries: number;
  good: number;
  moderate: number;
  poor: number;
  restDays: number;
}

export interface AreaScores {
  nutrition: { score: number | null; detail: NutritionDetail };
  training: { score: number | null; detail: TrainingDetail };
  activity: { score: number | null; detail: ActivityDetail };
  recovery: { score: number | null; detail: RecoveryDetail };
}

export interface ScoreResult {
  /** 0–100, `null` when no area could be rated at all. */
  score: number | null;
  band: ScoreBand | null;
  goal: ScoreGoal;
  /** Whether the goal comes from the nutrition profile (false = default weighting). */
  goalSet: boolean;
  areas: AreaScores;
  /** Weights of the main goal (before renormalisation). */
  weights: Record<ScoreArea, number>;
  preliminary: boolean;
  /** Days of the period with any own entry (food, workout, activity, recovery). */
  documentedDays: number;
  ratedAreas: number;
}

export const clampScore = (value: number) => Math.min(100, Math.max(0, value));
const round = (value: number) => Math.round(clampScore(value));

/**
 * One day's calories against its goal. Up to ±5 % keeps 100 points, beyond that 2 points per
 * percent – a small miss costs little, only a large one costs a lot. Today, being below the goal
 * is not judged (the day is not over): `null`.
 */
export function kcalDayScore(eaten: number, goal: number, isToday: boolean): number | null {
  if (goal <= 0) return null;
  const deviation = (eaten - goal) / goal;
  if (isToday && deviation < 0) return null;
  const beyond = Math.max(0, Math.abs(deviation) - NUTRITION.kcalTolerance);
  return clampScore(100 - beyond * 100 * NUTRITION.kcalPointsPerPercent);
}

/** One day's protein: from 90 % of the goal 100 points, below 2 points per missing percent. */
export function proteinDayScore(eaten: number, goal: number, isToday: boolean): number | null {
  if (goal <= 0) return null;
  const ratio = eaten / goal;
  if (ratio >= NUTRITION.proteinReached) return 100;
  if (isToday) return null;
  return clampScore(
    100 - (NUTRITION.proteinReached - ratio) * 100 * NUTRITION.proteinPointsPerPercent,
  );
}

const mean = (values: readonly number[]) =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * Nutrition: the mean of the logged days only (the existing definition – a day with at least one
 * entry). A day without entries is unknown, never 0 points. Goals are the day goals as the diary
 * shows them (manual before automatic, activity calories only when the setting is on).
 */
export function nutritionScore(input: ScoreInput): AreaScores['nutrition'] {
  const goals = new Map(input.nutrition.goals.map((goal) => [goal.localDate, goal]));
  const logged = input.nutrition.totals.filter((day) => input.dates.includes(day.localDate));
  const dayScores: number[] = [];
  const deviations: number[] = [];
  let proteinRatedDays = 0;
  let proteinReachedDays = 0;
  for (const day of logged) {
    const goal = goals.get(day.localDate);
    const isToday = day.localDate === input.today;
    const kcal =
      goal?.energyKcal != null ? kcalDayScore(day.energyKcal, goal.energyKcal, isToday) : null;
    const protein =
      goal?.proteinG != null ? proteinDayScore(day.proteinG, goal.proteinG, isToday) : null;
    if (kcal !== null && goal?.energyKcal != null) {
      deviations.push(((day.energyKcal - goal.energyKcal) / goal.energyKcal) * 100);
    }
    if (protein !== null) {
      proteinRatedDays++;
      if (protein === 100) proteinReachedDays++;
    }
    if (kcal !== null && protein !== null) {
      dayScores.push(kcal * NUTRITION.kcalShare + protein * NUTRITION.proteinShare);
    } else if (kcal !== null) {
      dayScores.push(kcal);
    } else if (protein !== null) {
      dayScores.push(protein);
    }
  }
  const score = mean(dayScores);
  const deviation = mean(deviations);
  return {
    score: score === null ? null : round(score),
    detail: {
      loggedDays: logged.length,
      ratedDays: dayScores.length,
      avgKcalDeviationPct: deviation === null ? null : Math.round(deviation),
      proteinRatedDays,
      proteinReachedDays,
    },
  };
}

/**
 * Training: completed Kalethra workouts against the weekly target, pro rata for the period
 * (3 per week → 3 in 7 days, ≈12.9 in 30). Plans have no calendar, so the target is a number
 * per week; days without training are never penalised by themselves, and doing more than the
 * target gives no bonus (capped at 100). With fewer than 7 days under a target (today, or a
 * target set only recently) a workout is 100 and none is not judged yet. Without a target the
 * area is neutral (`null`). Each day uses the target version in force on that day.
 */
export function trainingScore(input: ScoreInput): AreaScores['training'] {
  const workoutsOn = (include: (date: string) => boolean) =>
    input.training.workoutsPerDay
      .filter((day) => include(day.localDate))
      .reduce((sum, day) => sum + day.workouts, 0);
  const restDays = input.recovery.filter(
    (day) => day.restDay && input.dates.includes(day.localDate),
  ).length;
  const plan = expectation(input.targets.trainingsPerWeek, input.dates);
  if (plan.latest === null) {
    return {
      score: null,
      detail: {
        target: null,
        done: workoutsOn((date) => input.dates.includes(date)),
        expected: null,
        restDays,
      },
    };
  }
  // Only days with a target count – with one target for the whole period that is every day.
  const done = workoutsOn((date) => plan.days.has(date));
  const detail = {
    target: plan.latest,
    done,
    expected: Math.round(plan.expected * 10) / 10,
    restDays,
  };
  // Less than a week with a target (the "Heute" period, or a target set only a few days ago):
  // no fair weekly expectation yet – a workout counts as met, none is not judged.
  if (plan.days.size < 7) {
    return { score: done > 0 ? 100 : null, detail };
  }
  return { score: round((Math.min(done, plan.expected) / plan.expected) * 100), detail };
}

/**
 * Activity: active minutes (manual and Health Connect, a duplicate once, sessions that are a
 * Kalethra workout not again) against the weekly target, pro rata, capped at 100 – more activity
 * than the target gives no extra points. Without a target, or without any activity data in the
 * period (not tracked is not the same as not active), the area is neutral.
 */
export function activityScore(input: ScoreInput): AreaScores['activity'] {
  const active = (include: (date: string) => boolean) => {
    const perDay = input.activity.minutesPerDay.filter(
      (day) => include(day.localDate) && day.minutes > 0,
    );
    return {
      minutes: Math.round(perDay.reduce((sum, day) => sum + day.minutes, 0)),
      activeDays: perDay.length,
    };
  };
  const plan = expectation(input.targets.activeMinutesPerWeek, input.dates);
  if (plan.latest === null) {
    const all = active((date) => input.dates.includes(date));
    return { score: null, detail: { target: null, ...all, expectedMinutes: null } };
  }
  // Only days with a target count – with one target for the whole period that is every day.
  const { minutes, activeDays } = active((date) => plan.days.has(date));
  const expected = plan.expected;
  const detail = {
    target: plan.latest,
    minutes,
    expectedMinutes: Math.round(expected),
    activeDays,
  };
  if (minutes === 0) return { score: null, detail };
  return { score: round((Math.min(minutes, expected) / expected) * 100), detail };
}

/**
 * Recovery: the mean of the self-reported days (good 100, moderate 60, poor 20). A rest day is
 * never a minus – it only counts through how recovered the user felt. Days without an entry are
 * unknown, not bad.
 */
export function recoveryScore(input: ScoreInput): AreaScores['recovery'] {
  const days = input.recovery.filter((day) => input.dates.includes(day.localDate));
  const rated = days.flatMap((day) => (day.state ? [day.state] : []));
  const count = (state: RecoveryState) => rated.filter((value) => value === state).length;
  const score = mean(rated.map((state) => RECOVERY_POINTS[state]));
  return {
    score: score === null ? null : round(score),
    detail: {
      entries: rated.length,
      good: count('good'),
      moderate: count('moderate'),
      poor: count('poor'),
      restDays: days.filter((day) => day.restDay).length,
    },
  };
}

export function scoreBand(score: number): ScoreBand {
  let band: ScoreBand = 'low';
  for (const entry of SCORE_BANDS) if (score >= entry.min) band = entry.band;
  return band;
}

/** Days of the period with at least one own entry of any kind. */
function documentedDays(input: ScoreInput): number {
  const days = new Set<string>();
  for (const day of input.nutrition.totals) days.add(day.localDate);
  for (const day of input.training.workoutsPerDay) if (day.workouts > 0) days.add(day.localDate);
  for (const day of input.activity.minutesPerDay) if (day.minutes > 0) days.add(day.localDate);
  for (const day of input.recovery) if (day.state || day.restDay) days.add(day.localDate);
  return input.dates.filter((date) => days.has(date)).length;
}

/** Minimum documented days for a score that is not preliminary: half the period, at least 1. */
export function minDocumentedDays(periodDays: number): number {
  return Math.max(1, Math.ceil(periodDays * PRELIMINARY.documentedShare));
}

export function calculateScore(input: ScoreInput): ScoreResult {
  const goal = input.goal ?? DEFAULT_SCORE_GOAL;
  const weights = SCORE_WEIGHTS[goal];
  const areas: AreaScores = {
    nutrition: nutritionScore(input),
    training: trainingScore(input),
    activity: activityScore(input),
    recovery: recoveryScore(input),
  };
  // Area scores are rounded first, so the total can be retraced from the shown numbers.
  let weighted = 0;
  let weightSum = 0;
  let ratedAreas = 0;
  for (const area of SCORE_AREAS) {
    const value = areas[area].score;
    if (value === null) continue;
    weighted += value * weights[area];
    weightSum += weights[area];
    ratedAreas++;
  }
  const score = weightSum > 0 ? round(weighted / weightSum) : null;
  const documented = documentedDays(input);
  return {
    score,
    band: score === null ? null : scoreBand(score),
    goal,
    goalSet: input.goal !== null,
    areas,
    weights,
    preliminary:
      score !== null &&
      (documented < minDocumentedDays(input.dates.length) ||
        ratedAreas < PRELIMINARY.minRatedAreas),
    documentedDays: documented,
    ratedAreas,
  };
}

export type ScoreTrend = 'up' | 'down' | 'steady' | 'none';

/**
 * Current period against the one right before it. Changes below `TREND_THRESHOLD` points read
 * as "about the same"; without a usable previous score (none, or fewer documented days than a
 * non-preliminary score needs) there is no trend.
 */
export function scoreTrend(
  current: Pick<ScoreResult, 'score'>,
  previous: Pick<ScoreResult, 'score' | 'documentedDays'>,
  periodDays: number,
): { trend: ScoreTrend; delta: number | null } {
  if (
    current.score === null ||
    previous.score === null ||
    previous.documentedDays < minDocumentedDays(periodDays)
  ) {
    return { trend: 'none', delta: null };
  }
  const delta = current.score - previous.score;
  if (Math.abs(delta) < TREND_THRESHOLD) return { trend: 'steady', delta };
  return { trend: delta > 0 ? 'up' : 'down', delta };
}
