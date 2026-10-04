/**
 * The Kalethra score: how well the documented data of a period meets the user's own goals.
 * Pure and deterministic – the same input always gives the same result; nothing is stored.
 *
 * Four areas, each 0–100 or `null` (= not rateable, treated as neutral): nutrition, training,
 * activity, recovery. The total is the weighted mean of the rated areas with the weights of the
 * main goal, renormalised over those areas – a missing area neither adds nor costs points.
 * It describes goal achievement inside Kalethra only; it is no health or medical rating.
 */
import {
  calorieGoalScore,
  type GoalType,
  type NutritionDayGoal,
  type NutritionDayTotals,
} from '@/core/nutrition';
import type { RecoveryState } from '@/core/recovery';
import { summarizeStepGoal } from '@/core/health';
import { targetValueOn, weeklyExpectation as expectation, type TargetValue } from '@/core/targets';
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
  /** Today's local day – today is still running and judged against the time of day. */
  today: string;
  /**
   * Share of today already past (0–1, `dayProgress` of the device's local clock). Only the
   * nutrition of the running day depends on it; closed days never do.
   */
  todayProgress: number;
  nutrition: { totals: readonly NutritionDayTotals[]; goals: readonly NutritionDayGoal[] };
  /** Completed Kalethra workouts per day; Health Connect and manual activities never count. */
  training: { workoutsPerDay: readonly { localDate: string; workouts: number }[] };
  activity: {
    /** Countable activity minutes per day (both sources, duplicates once, no Kalethra workouts). */
    minutesPerDay: readonly { localDate: string; minutes: number }[];
    /**
     * Steps per day outside tracked activities (`countableStepsPerDay`, Health Connect only);
     * a day without step data is missing here, never 0.
     */
    stepsPerDay?: readonly { localDate: string; steps: number }[];
  };
  recovery: readonly ScoreRecoveryDay[];
  /**
   * Weekly targets – one value for the whole period, or the value in force on each day
   * (versioned targets: a past day keeps the target that applied then).
   */
  targets: {
    trainingsPerWeek: TargetValue;
    activeMinutesPerWeek: TargetValue;
    /** Daily step goal – an additional signal inside the activity area, no area of its own. */
    stepsPerDay?: TargetValue;
  };
}

export interface NutritionDetail {
  loggedDays: number;
  /** Whether today is among the logged days – it is judged against the time of day. */
  runningDay: boolean;
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
  /** Part score of the active minutes (`null` = not rated). */
  minutesScore: number | null;
  /** Steps outside tracked activities against the daily step goal. */
  steps: StepsDetail;
}

export interface StepsDetail {
  /** Step goal on the last day of the period; `null` without one. */
  target: number | null;
  /** Average counted steps of the rated days; `null` without a rated day. */
  avgSteps: number | null;
  /** Days with a step goal and step data that could be judged (today below the goal is open). */
  ratedDays: number;
  reachedDays: number;
  /** Part score of the steps (`null` = not rated). */
  score: number | null;
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

const SECONDS_PER_DAY = 24 * 60 * 60;

/**
 * Share of the local day already past – `elapsed time since local midnight / 24 h`, 0 at
 * midnight, never above 1. From the device's clock only, no server time. (On the two days a
 * year with a clock change the day is still read as 24 hours; the corridor absorbs the hour.)
 */
export function dayProgress(now: Date): number {
  const elapsed = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return Math.min(1, Math.max(0, elapsed / SECONDS_PER_DAY));
}

/**
 * The corridor of the running day: the goal × the share of the day past, ± one meal
 * (`NUTRITION.runningDayAllowance`), within 0…goal. The allowance is also the guard against
 * unstable values right after midnight: the upper edge never falls below a quarter of the goal,
 * so no small snack can turn into an extreme excess, and the lower edge stays 0 until 06:00.
 */
export function runningDayCorridor(
  goal: number,
  progress: number,
): { lower: number; upper: number } {
  const share = Math.min(1, Math.max(0, progress));
  const allowance = NUTRITION.runningDayAllowance;
  return {
    lower: goal * Math.max(0, share - allowance),
    upper: goal * Math.min(1, share + allowance),
  };
}

/**
 * One day's calories against its goal, by the day's main goal – the shared rule of score and
 * progress card (`calorieGoalScore`, core/nutrition/goalAttainment.ts): lose = upper limit,
 * gain = reached from 95 %, maintain/fitness = 95–105 %. A closed day (`todayProgress` null) is
 * judged exactly by that rule. The running day is judged against its corridor
 * (`runningDayCorridor`): inside → 100; above the upper edge or below the lower edge the same
 * rule applies with that edge as the goal – so eating too much shows during the day, while a
 * normal interim value (breakfast in the morning) is no minus, and below the corridor only
 * gain and maintain/fitness lose points (for lose the goal stays an upper limit).
 */
export function kcalDayScore(
  eaten: number,
  goal: number,
  todayProgress: number | null,
  goalType: GoalType | null = null,
): number | null {
  if (todayProgress === null) return calorieGoalScore(goalType, eaten, goal, false);
  if (goal <= 0) return null;
  const { lower, upper } = runningDayCorridor(goal, todayProgress);
  if (eaten > upper) return calorieGoalScore(goalType, eaten, upper, false);
  if (eaten < lower) return calorieGoalScore(goalType, eaten, lower, false);
  return 100;
}

/**
 * One day's protein: from 90 % of the goal 100 points, below 2 points per missing percent. The
 * running day compares with the lower edge of its corridor instead of the whole goal (more is
 * never a minus); before anything is expected (lower edge 0) it is on track.
 */
export function proteinDayScore(
  eaten: number,
  goal: number,
  todayProgress: number | null,
): number | null {
  if (goal <= 0) return null;
  const expected = todayProgress === null ? goal : runningDayCorridor(goal, todayProgress).lower;
  if (expected <= 0) return 100;
  const ratio = eaten / expected;
  if (ratio >= NUTRITION.proteinReached) return 100;
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
    const progress = isToday ? input.todayProgress : null;
    const kcal =
      goal?.energyKcal != null
        ? kcalDayScore(day.energyKcal, goal.energyKcal, progress, goal.goalType ?? null)
        : null;
    const protein =
      goal?.proteinG != null ? proteinDayScore(day.proteinG, goal.proteinG, progress) : null;
    // The figures in the details describe the whole day goal: the running day only adds to
    // them once it is over its calorie goal or has reached its protein goal.
    if (
      kcal !== null &&
      goal?.energyKcal != null &&
      (!isToday || day.energyKcal >= goal.energyKcal)
    ) {
      deviations.push(((day.energyKcal - goal.energyKcal) / goal.energyKcal) * 100);
    }
    const proteinReached =
      goal?.proteinG != null && day.proteinG / goal.proteinG >= NUTRITION.proteinReached;
    if (protein !== null && (!isToday || proteinReached)) {
      proteinRatedDays++;
      if (isToday || protein === 100) proteinReachedDays++;
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
      runningDay: logged.some((day) => day.localDate === input.today),
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
 * Steps outside tracked activities against the daily step goal – through the one step
 * evaluation (`summarizeStepGoal`, core/health/steps.ts) that Gesundheit and Fortschritt use too:
 * each day its share of the goal, capped at 100 – today as well (proportional since Phase 16);
 * the mean of the rated days. Days without a goal or without step data are not rated (never 0
 * steps).
 */
export function stepsPart(input: ScoreInput): StepsDetail {
  const target = input.targets.stepsPerDay ?? null;
  const summary = summarizeStepGoal(
    (input.activity.stepsPerDay ?? []).map((day) => ({ date: day.localDate, steps: day.steps })),
    input.dates,
    (date) => targetValueOn(target, date),
  );
  return {
    target: summary.latestGoal,
    avgSteps: summary.avgRatedSteps,
    ratedDays: summary.ratedDays,
    reachedDays: summary.reachedDays,
    score: summary.avgRatio === null ? null : round(summary.avgRatio * 100),
  };
}

/**
 * Activity: two signals inside the one activity area (its weight is unchanged):
 * - active minutes (manual and Health Connect, a duplicate once, sessions that are a Kalethra
 *   workout not again) against the weekly target, pro rata, capped at 100 – more activity than
 *   the target gives no extra points. Without a target, or without any activity data in the
 *   period (not tracked is not the same as not active), this signal is not rated;
 * - steps outside tracked activities against the daily step goal (`stepsPart`).
 * Both rated → their mean; one rated → that one; none → the area is neutral.
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
  const steps = stepsPart(input);
  const combine = (minutesScore: number | null) => {
    const parts = [minutesScore, steps.score].flatMap((part) => (part === null ? [] : [part]));
    const value = mean(parts);
    return value === null ? null : round(value);
  };
  const plan = expectation(input.targets.activeMinutesPerWeek, input.dates);
  if (plan.latest === null) {
    const all = active((date) => input.dates.includes(date));
    return {
      score: combine(null),
      detail: { target: null, ...all, expectedMinutes: null, minutesScore: null, steps },
    };
  }
  // Only days with a target count – with one target for the whole period that is every day.
  const { minutes, activeDays } = active((date) => plan.days.has(date));
  // The goal in whole minutes – the one the progress card shows (20 of 26 → 77 on both).
  const expected = Math.max(1, plan.expectedWhole);
  const minutesScore = minutes === 0 ? null : round((Math.min(minutes, expected) / expected) * 100);
  return {
    score: combine(minutesScore),
    detail: {
      target: plan.latest,
      minutes,
      expectedMinutes: expected,
      activeDays,
      minutesScore,
      steps,
    },
  };
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
