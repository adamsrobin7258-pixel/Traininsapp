/**
 * Personal targets beyond nutrition: workouts and active minutes per week, steps per day.
 * Versioned like the nutrition goals: each change starts a new version on the day it is made
 * (`effectiveFrom`), so a past period is always judged by the target that applied then. Pure.
 */
export const TARGET_KINDS = ['trainingsPerWeek', 'activeMinutesPerWeek', 'stepsPerDay'] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

/** Allowed values per kind (whole numbers); `null` = "no target". */
export const TARGET_LIMITS: Record<TargetKind, { min: number; max: number }> = {
  trainingsPerWeek: { min: 1, max: 14 },
  activeMinutesPerWeek: { min: 10, max: 2000 },
  stepsPerDay: { min: 1000, max: 50000 },
};

/** Choices offered in the settings (chosen from a list – no keyboard). */
export const TARGET_OPTIONS: Record<TargetKind, readonly number[]> = {
  trainingsPerWeek: [1, 2, 3, 4, 5, 6, 7],
  activeMinutesPerWeek: [60, 90, 120, 150, 180, 240, 300],
  stepsPerDay: [4000, 5000, 6000, 7000, 8000, 10000, 12000, 15000],
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

/** All versions of every kind, ready to look values up by day. */
export type TargetHistory = Record<TargetKind, readonly TargetVersion[]>;

export function emptyTargetHistory(): TargetHistory {
  return { trainingsPerWeek: [], activeMinutesPerWeek: [], stepsPerDay: [] };
}
