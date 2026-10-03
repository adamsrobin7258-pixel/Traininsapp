/**
 * Personal targets beyond nutrition: workouts and active minutes per week, steps per day – and
 * the switch "Aktivitätskalorien anrechnen" (`activityCalories`, 1 = on, 0 = off), which decides
 * whether a day's calorie goal includes its activity calories.
 * Versioned like the nutrition goals: each change starts a new version on the day it is made
 * (`effectiveFrom`), so a past period is always judged by the target that applied then. Pure.
 */
export const TARGET_KINDS = [
  'trainingsPerWeek',
  'activeMinutesPerWeek',
  'stepsPerDay',
  'activityCalories',
] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

/** Allowed values per kind (whole numbers); `null` = "no target". */
export const TARGET_LIMITS: Record<TargetKind, { min: number; max: number }> = {
  trainingsPerWeek: { min: 1, max: 14 },
  activeMinutesPerWeek: { min: 10, max: 2000 },
  stepsPerDay: { min: 1000, max: 50000 },
  activityCalories: { min: 0, max: 1 },
};

/** Choices offered in the settings (chosen from a list – no keyboard). */
export const TARGET_OPTIONS: Record<TargetKind, readonly number[]> = {
  trainingsPerWeek: [1, 2, 3, 4, 5, 6, 7],
  activeMinutesPerWeek: [60, 90, 120, 150, 180, 240, 300],
  stepsPerDay: [4000, 5000, 6000, 7000, 8000, 10000, 12000, 15000],
  activityCalories: [0, 1],
};

/**
 * The first local day of the versions taken over from the unversioned settings (migration 14):
 * before versioning, a target applied to every day, so the taken-over value does as well.
 */
export const INITIAL_EFFECTIVE_FROM = '1970-01-01';

export interface TargetVersion {
  id: string;
  profileId: string;
  kind: TargetKind;
  /** First local day (YYYY-MM-DD) this value applies to; valid until the next version starts. */
  effectiveFrom: string;
  /** `null` = no target from this day on. */
  value: number | null;
  createdAt: string;
  updatedAt: string;
}

export class TargetError extends Error {
  constructor(readonly code: 'invalid-kind' | 'invalid-value' | 'invalid-date') {
    super(`Target: ${code}`);
    this.name = 'TargetError';
  }
}

export const isTargetKind = (value: unknown): value is TargetKind =>
  (TARGET_KINDS as readonly unknown[]).includes(value);

export function isValidTargetValue(kind: TargetKind, value: unknown): value is number | null {
  if (value === null) return true;
  const { min, max } = TARGET_LIMITS[kind];
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

/** The value in force on `localDate`: the latest version that started on or before it. */
export function targetOn(
  versions: readonly Pick<TargetVersion, 'effectiveFrom' | 'value'>[],
  localDate: string,
): number | null {
  let found: Pick<TargetVersion, 'effectiveFrom' | 'value'> | null = null;
  for (const version of versions) {
    if (
      version.effectiveFrom <= localDate &&
      (!found || version.effectiveFrom > found.effectiveFrom)
    ) {
      found = version;
    }
  }
  return found?.value ?? null;
}

/**
 * Whether activity calories count towards the calorie goal on `localDate`: the switch as it was
 * set then. Off without any version (the default).
 */
export function countsActivityCaloriesOn(
  versions: readonly Pick<TargetVersion, 'effectiveFrom' | 'value'>[],
  localDate: string,
): boolean {
  return targetOn(versions, localDate) === 1;
}

/** All versions of every kind, ready to look values up by day. */
export type TargetHistory = Record<TargetKind, readonly TargetVersion[]>;

export function emptyTargetHistory(): TargetHistory {
  return { trainingsPerWeek: [], activeMinutesPerWeek: [], stepsPerDay: [], activityCalories: [] };
}

/** A target: the same for every day, or looked up per local day; `null` = no target. */
export type TargetValue = number | null | ((localDate: string) => number | null);

/** The positive target in force on a day; `null` (or 0) means no target on that day. */
export function targetValueOn(target: TargetValue, localDate: string): number | null {
  const value = typeof target === 'function' ? target(localDate) : target;
  return value !== null && value > 0 ? value : null;
}

export interface WeeklyExpectation {
  /** The days of the period that have a target. */
  days: ReadonlySet<string>;
  /** Expected amount over those days: the sum of each day's weekly target ÷ 7. */
  expected: number;
  /**
   * The expectation in whole units (e.g. active minutes: 180 per week → 26 today) – what the
   * progress card shows and what the score divides by, so both read the same goal (Phase 16).
   */
  expectedWhole: number;
  /** The target that applies at the end of the period (`null` without any). */
  latest: number | null;
}

/**
 * A weekly target spread over the days of a period, each day with the version in force on it:
 * 3 per week → 3 in 7 days, ≈12.9 in 30; target 4 for three days and 3 for four days → 3.4.
 * Days without a target do not count. The one definition used by the score and the progress
 * cards (Phase 14).
 */
export function weeklyExpectation(
  target: TargetValue,
  dates: readonly string[],
): WeeklyExpectation {
  const days = dates.flatMap((date) => {
    const value = targetValueOn(target, date);
    return value === null ? [] : [{ date, value }];
  });
  const expected = days.reduce((sum, day) => sum + day.value / 7, 0);
  return {
    days: new Set(days.map((day) => day.date)),
    expected,
    expectedWhole: Math.round(expected),
    latest: days.at(-1)?.value ?? null,
  };
}
