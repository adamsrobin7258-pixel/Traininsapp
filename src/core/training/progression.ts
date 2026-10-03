import type { ProgressionMode } from '@/core/settings/types';
import { fromKg, toKg, type WeightUnit } from '@/shared/lib/units';
import { estimateOneRepMaxKg } from './metrics';
import type { WorkoutSet } from './sets';

/**
 * Weight increase suggestions ("Gewichtssteigerung vorschlagen"). Deterministic, local and only
 * a hint – nothing is ever raised automatically; the user decides on load and reps.
 *
 * A suggestion needs the plan's rep target of the exercise (e.g. 3 × 8). A session counts as
 * successful when every completed working set used the same load and reached the target reps
 * (and, if the plan sets a number of sets, at least that many working sets were completed).
 * Only when the most recent `sessions` sessions in a row were successful with the same load,
 * Kalethra suggests a higher load:
 *
 *   increase = `increasePercent` of the load, rounded to the nearest load step (1.25 kg or
 *              2.5 lb), at least one step
 *   reps     = the reps that keep the same estimated one-repetition maximum (Epley, as in
 *              metrics.ts) at the higher load, rounded down
 *
 * Example (normal): 80 kg × 8 in three sessions in a row → 83.75 kg × 6.
 *
 * With fewer reps at the higher load, the next suggestion only comes once the target reps are
 * reached at that load again – the target never drifts down. Warm-ups and drops are ignored.
 */

export interface ProgressionRule {
  /** Successful sessions in a row with the same load before a suggestion. */
  sessions: number;
  /** Load increase in percent of the current load (rounded to the load step). */
  increasePercent: number;
}

export const PROGRESSION_RULES: Record<Exclude<ProgressionMode, 'off'>, ProgressionRule> = {
  cautious: { sessions: 4, increasePercent: 2.5 },
  normal: { sessions: 3, increasePercent: 5 },
  progressive: { sessions: 2, increasePercent: 7.5 },
};

/** Smallest load change, in the user's unit (common plate steps). */
export const LOAD_STEP: Record<WeightUnit, number> = { kg: 1.25, lb: 2.5 };

/** Epley is not reliable above 12 reps (metrics.ts) – no suggestion for higher targets. */
export const PROGRESSION_MAX_TARGET_REPS = 12;

/** The most sessions any mode needs – how much history the service loads. */
export const PROGRESSION_MAX_SESSIONS = Math.max(
  ...Object.values(PROGRESSION_RULES).map((rule) => rule.sessions),
);

export interface ProgressionTarget {
  /** Target reps per working set from the plan. */
  reps: number;
  /** Planned working sets; `null` = not set in the plan. */
  sets: number | null;
}

export interface ProgressionSuggestion {
  /** The load held in the successful sessions and the target reps. */
  fromKg: number;
  fromReps: number;
  /** Suggested load (kg) and reps. */
  weightKg: number;
  reps: number;
  /** How many successful sessions in a row led to it. */
  sessions: number;
}

const SAME_LOAD_KG = 1e-6;

/**
 * The load of a session if it was successful against the target, else `null`. `sets` are the
 * sets of one exercise in one completed workout.
 */
export function successfulLoadKg(
  sets: readonly WorkoutSet[],
  target: ProgressionTarget,
): number | null {
  const working = sets.filter((set) => set.setType === 'working' && set.completed);
  if (working.length === 0 || working.length < (target.sets ?? 1)) return null;
  const first = working[0]?.weightKg ?? null;
  if (first === null || first <= 0) return null;
  for (const set of working) {
    if (set.weightKg === null || Math.abs(set.weightKg - first) > SAME_LOAD_KG) return null;
    if (set.reps === null || set.reps < target.reps) return null;
  }
  return first;
}

/** `loadKg` raised by the mode's percentage, rounded to the load step of `unit`. */
export function raisedLoadKg(loadKg: number, increasePercent: number, unit: WeightUnit): number {
  const step = LOAD_STEP[unit];
  const load = fromKg(loadKg, unit);
  const steps = Math.max(1, Math.round((load * increasePercent) / 100 / step));
  return toKg(load + steps * step, unit);
}

/** Reps at `toKg` that keep the estimated one-repetition maximum of `fromKg × reps`. */
export function repsAtLoad(fromKg: number, reps: number, toKgLoad: number): number | null {
  const oneRepMax = estimateOneRepMaxKg(fromKg, reps);
  if (oneRepMax === null || toKgLoad <= fromKg) return null;
  const next = Math.floor(30 * (oneRepMax / toKgLoad - 1) + 1e-9);
  return next >= 1 ? Math.min(next, reps - 1) : null;
}

/**
 * The suggestion for the next session, or `null`. `sessions` are the sets of the exercise per
 * completed workout, newest first.
 */
export function suggestProgression(
  sessions: readonly (readonly WorkoutSet[])[],
  target: ProgressionTarget | null,
  mode: ProgressionMode,
  unit: WeightUnit,
): ProgressionSuggestion | null {
  if (mode === 'off' || !target) return null;
  if (!Number.isInteger(target.reps) || target.reps < 1) return null;
  if (target.reps > PROGRESSION_MAX_TARGET_REPS) return null;
  const rule = PROGRESSION_RULES[mode];
  if (sessions.length < rule.sessions) return null;
  let load: number | null = null;
  for (const sets of sessions.slice(0, rule.sessions)) {
    const held = successfulLoadKg(sets, target);
    if (held === null) return null;
    if (load !== null && Math.abs(held - load) > SAME_LOAD_KG) return null;
    load = held;
  }
  if (load === null) return null;
  const weightKg = raisedLoadKg(load, rule.increasePercent, unit);
  const reps = repsAtLoad(load, target.reps, weightKg);
  if (reps === null) return null;
  return { fromKg: load, fromReps: target.reps, weightKg, reps, sessions: rule.sessions };
}
