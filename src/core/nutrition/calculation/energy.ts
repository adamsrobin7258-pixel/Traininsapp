import { parseLocalDateKey } from '@/shared/lib/date';
import type { GoalType } from '../goals';
import {
  ACTIVITY_FACTORS,
  DEFICIT_KCAL,
  KCAL_PER_KG_BODY_WEIGHT,
  MAX_DEFICIT_SHARE,
  MIFFLIN,
  MIN_ENERGY_KCAL,
  SURPLUS,
  TRAINING,
  TRAINING_MET,
  type ActivityLevel,
  type GoalLevel,
  type Sex,
  type TrainingCategory,
} from './parameters';

/** Completed age in years on a day (birthday counted on the day itself). */
export function ageOn(birthDate: string, onDate: string): number | null {
  const birth = parseLocalDateKey(birthDate);
  const day = parseLocalDateKey(onDate);
  if (!birth || !day || birth > day) return null;
  let age = day.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    day.getMonth() < birth.getMonth() ||
    (day.getMonth() === birth.getMonth() && day.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Estimated resting metabolic rate (Mifflin-St Jeor), kcal/day. */
export function restingEnergy(input: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}): number {
  return (
    MIFFLIN.perKg * input.weightKg +
    MIFFLIN.perCm * input.heightCm +
    MIFFLIN.perYear * input.ageYears +
    MIFFLIN.constant[input.sex]
  );
}

/** RMR including everyday activity (without sport). */
export function everydayEnergy(rmrKcal: number, level: ActivityLevel): number {
  return rmrKcal * ACTIVITY_FACTORS[level];
}

export interface TrainingSession {
  localDate: string;
  durationMinutes: number;
  category: TrainingCategory;
}

export interface TrainingEstimate {
  /** Average extra kcal per day over the window. */
  kcalPerDay: number;
  sessions: number;
  minutesPerDay: number;
  strengthSessions: number;
}

/**
 * Energy of logged workouts above rest, averaged over the window: Σ (MET − 1) × kg × hours ÷
 * days. Sessions are capped in length and the daily result is capped, so long or forgotten
 * timers cannot inflate the target.
 */
export function trainingEnergy(
  sessions: readonly TrainingSession[],
  weightKg: number,
): TrainingEstimate {
  let kcal = 0;
  let minutes = 0;
  let strengthSessions = 0;
  for (const session of sessions) {
    const length = Math.min(Math.max(0, session.durationMinutes), TRAINING.maxMinutesPerSession);
    if (!Number.isFinite(length) || length === 0) continue;
    minutes += length;
    kcal += (TRAINING_MET[session.category] - 1) * weightKg * (length / 60);
    if (session.category === 'strength') strengthSessions += 1;
  }
  return {
    kcalPerDay: Math.min(kcal / TRAINING.windowDays, TRAINING.maxKcalPerDay),
    sessions: sessions.length,
    minutesPerDay: minutes / TRAINING.windowDays,
    strengthSessions,
  };
}

export interface GoalAdjustment {
  /** Adjustment the level asks for (negative = deficit). */
  requestedKcal: number;
  /** Adjustment actually applied after the safety bounds. */
  appliedKcal: number;
  targetKcal: number;
  /** Why the requested adjustment was reduced, if it was. */
  limitedBy: 'deficit-share' | 'minimum' | 'surplus-cap' | null;
  /** Approximate change of body weight in kg per week implied by the applied adjustment. */
  expectedKgPerWeek: number;
}

/**
 * Target energy from maintenance and goal. A deficit is bounded by a share of maintenance and
 * never leads below the RMR or the absolute minimum.
 */
export function adjustForGoal(
  maintenanceKcal: number,
  rmrKcal: number,
  goalType: GoalType,
  level: GoalLevel | null,
): GoalAdjustment {
  const floor = Math.max(rmrKcal, MIN_ENERGY_KCAL);
  let requested = 0;
  let applied = 0;
  let limitedBy: GoalAdjustment['limitedBy'] = null;

  if (goalType === 'lose') {
    requested = -DEFICIT_KCAL[level === 'slow' || level === 'fast' ? level : 'moderate'];
    const maxDeficit = maintenanceKcal * MAX_DEFICIT_SHARE;
    applied = requested;
    if (-applied > maxDeficit) {
      applied = -maxDeficit;
      limitedBy = 'deficit-share';
    }
    if (maintenanceKcal + applied < floor) {
      applied = Math.min(0, floor - maintenanceKcal);
      limitedBy = 'minimum';
    }
  } else if (goalType === 'gain') {
    const surplus = SURPLUS[level === 'higher' ? 'higher' : 'moderate'];
    requested = maintenanceKcal * surplus.share;
    applied = Math.min(requested, surplus.maxKcal);
    if (applied < requested) limitedBy = 'surplus-cap';
  }

  return {
    requestedKcal: requested,
    appliedKcal: applied,
    targetKcal: maintenanceKcal + applied,
    limitedBy,
    expectedKgPerWeek: (applied * 7) / KCAL_PER_KG_BODY_WEIGHT,
  };
}

/** What a goal level means, for explaining it before anything is calculated. */
export function describeLevel(
  goalType: GoalType,
  level: GoalLevel | null,
):
  | { kind: 'deficit'; kcalPerDay: number; kgPerWeek: number }
  | { kind: 'surplus'; share: number }
  | { kind: 'none' } {
  if (goalType === 'lose') {
    const kcalPerDay = DEFICIT_KCAL[level === 'slow' || level === 'fast' ? level : 'moderate'];
    return { kind: 'deficit', kcalPerDay, kgPerWeek: (kcalPerDay * 7) / KCAL_PER_KG_BODY_WEIGHT };
  }
  if (goalType === 'gain')
    return { kind: 'surplus', share: SURPLUS[level === 'higher' ? 'higher' : 'moderate'].share };
  return { kind: 'none' };
}
