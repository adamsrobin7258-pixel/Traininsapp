import { parseDecimalInput, toKg, type WeightUnit } from '@/shared/lib/units';
import type { ExerciseType } from './exercise';

/**
 * One set. The same structure serves every exercise type; which fields are required depends
 * on the exercise type (see REQUIREMENTS). Loads are stored in kilograms, durations in
 * seconds, distances in metres – display converts.
 */
export interface SetValues {
  weightKg: number | null;
  reps: number | null;
  durationS: number | null;
  distanceM: number | null;
  /** Rate of perceived exertion, 1–10 in half steps. Optional. */
  rpe: number | null;
}

export interface WorkoutSet extends SetValues {
  id: string;
  workoutExerciseId: string;
  position: number;
  /** Only completed sets count for volume and records. */
  completed: boolean;
}

export const EMPTY_SET_VALUES: SetValues = {
  weightKg: null,
  reps: null,
  durationS: null,
  distanceM: null,
  rpe: null,
};

/**
 * Plausibility limits. Generous enough for elite athletes (world-record lifts are around
 * 500 kg), strict enough to catch typos. Documented in docs/DATABASE.md.
 */
export const SET_LIMITS = {
  weightKg: { min: 0, max: 1000 },
  reps: { min: 1, max: 500 },
  durationS: { min: 1, max: 24 * 60 * 60 },
  distanceM: { min: 1, max: 100_000 },
  rpe: { min: 1, max: 10, step: 0.5 },
} as const;

/** Load input precision: 0.01 allows fractional plates (e.g. 1.25 kg, 2.5 lb). */
export const WEIGHT_INPUT_DECIMALS = 2;

type Field = keyof SetValues;

const REQUIREMENTS: Record<ExerciseType, { required: Field[]; allowed: Field[] }> = {
  weighted: { required: ['weightKg', 'reps'], allowed: ['weightKg', 'reps', 'rpe'] },
  bodyweight: { required: ['reps'], allowed: ['weightKg', 'reps', 'rpe'] },
  timed: { required: ['durationS'], allowed: ['durationS', 'weightKg', 'rpe'] },
  distance: { required: ['distanceM'], allowed: ['distanceM', 'durationS', 'weightKg', 'rpe'] },
};

/** Fields the set input shows for an exercise type, in display order. */
export function setFieldsFor(type: ExerciseType): readonly Field[] {
  return REQUIREMENTS[type].allowed;
}

export type SetError =
  | { field: Field; problem: 'required' }
  | { field: Field; problem: 'range' }
  | { field: Field; problem: 'integer' }
  | { field: Field; problem: 'step' }
  | { field: Field; problem: 'notAllowed' };

function inRange(value: number, { min, max }: { min: number; max: number }) {
  return Number.isFinite(value) && value >= min && value <= max;
}

/** Checks a set that is about to be completed. An empty list means valid. */
export function validateSet(values: SetValues, type: ExerciseType): SetError[] {
  const errors: SetError[] = [];
  const rules = REQUIREMENTS[type];

  for (const field of rules.required) {
    if (values[field] === null) errors.push({ field, problem: 'required' });
  }
  for (const field of Object.keys(values) as Field[]) {
    if (values[field] !== null && !rules.allowed.includes(field)) {
      errors.push({ field, problem: 'notAllowed' });
    }
  }

  const { weightKg, reps, durationS, distanceM, rpe } = values;
  if (weightKg !== null && !inRange(weightKg, SET_LIMITS.weightKg)) {
    errors.push({ field: 'weightKg', problem: 'range' });
  }
  if (reps !== null) {
    if (!Number.isInteger(reps)) errors.push({ field: 'reps', problem: 'integer' });
    else if (!inRange(reps, SET_LIMITS.reps)) errors.push({ field: 'reps', problem: 'range' });
  }
  if (durationS !== null) {
    if (!Number.isInteger(durationS)) errors.push({ field: 'durationS', problem: 'integer' });
    else if (!inRange(durationS, SET_LIMITS.durationS)) {
      errors.push({ field: 'durationS', problem: 'range' });
    }
  }
  if (distanceM !== null && !inRange(distanceM, SET_LIMITS.distanceM)) {
    errors.push({ field: 'distanceM', problem: 'range' });
  }
  if (rpe !== null) {
    if (!inRange(rpe, SET_LIMITS.rpe)) errors.push({ field: 'rpe', problem: 'range' });
    else if (!Number.isInteger(rpe / SET_LIMITS.rpe.step)) {
      errors.push({ field: 'rpe', problem: 'step' });
    }
  }
  return errors;
}

/** True when no field holds a value (an untouched placeholder row). */
export function isEmptySet(values: SetValues): boolean {
  return Object.values(values).every((value) => value === null);
}

export type FieldInput =
  { ok: true; value: number | null } | { ok: false; problem: 'invalid' | 'precision' };

/** Empty input means "no value" for optional fields. */
function parseOptional(input: string, maxDecimals: number): FieldInput {
  const parsed = parseDecimalInput(input, { maxDecimals });
  if (parsed.ok) return { ok: true, value: parsed.value };
  if (parsed.error === 'empty') return { ok: true, value: null };
  return { ok: false, problem: parsed.error };
}

/** Load typed in the user's unit → kilograms (converted once, not rounded). */
export function parseLoadInput(input: string, unit: WeightUnit): FieldInput {
  const parsed = parseOptional(input, WEIGHT_INPUT_DECIMALS);
  return parsed.ok && parsed.value !== null
    ? { ok: true, value: toKg(parsed.value, unit) }
    : parsed;
}

/** Repetitions: whole numbers only. */
export function parseRepsInput(input: string): FieldInput {
  return parseOptional(input, 0);
}

/** RPE: one decimal place, validated for half steps by validateSet. */
export function parseRpeInput(input: string): FieldInput {
  return parseOptional(input, 1);
}

/** Duration in whole seconds. */
export function parseDurationInput(input: string): FieldInput {
  return parseOptional(input, 0);
}

/** Distance in metres, one decimal place. */
export function parseDistanceInput(input: string): FieldInput {
  return parseOptional(input, 1);
}
