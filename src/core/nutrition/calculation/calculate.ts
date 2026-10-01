import type { GoalType } from '../goals';
import {
  adjustForGoal,
  ageOn,
  everydayEnergy,
  restingEnergy,
  trainingEnergy,
  type GoalAdjustment,
  type TrainingEstimate,
  type TrainingSession,
} from './energy';
import { proteinTarget, splitMacros, type ProteinResult } from './macros';
import {
  ACTIVITY_FACTORS,
  CALCULATION_VERSION,
  GOAL_LEVELS,
  INPUT_LIMITS,
  MIN_ENERGY_KCAL,
  MIN_TARGET_BMI,
  ROUNDING,
  TRAINING,
  type ActivityLevel,
  type GoalLevel,
  type Sex,
} from './parameters';
import { weightTrend, type WeightPoint, type WeightTrend } from './trend';

/** The calculated goal values (water is always set by the user). */
export const MACRO_TARGETS = ['energyKcal', 'proteinG', 'carbsG', 'fatG'] as const;
export type MacroTarget = (typeof MACRO_TARGETS)[number];
export type MacroValues = Record<MacroTarget, number | null>;
export type Overrides = Partial<MacroValues>;

/** Stored with the profile (core/user); never duplicated per goal. */
export interface PersonalData {
  sex: Sex | null;
  /** YYYY-MM-DD; the age is derived for each calculation. */
  birthDate: string | null;
  heightCm: number | null;
}

/** The choices of a nutrition profile version. */
export interface ProfileParams {
  goalType: GoalType;
  goalLevel: GoalLevel | null;
  activityLevel: ActivityLevel | null;
  includeTraining: boolean;
  targetWeightKg: number | null;
}

export interface CalculationInput {
  onDate: string;
  personal: PersonalData;
  params: ProfileParams;
  /** Weight entries around the day (at least the last 7 days and the latest before). */
  weights: readonly WeightPoint[];
  /** Completed workouts of the training window ending on `onDate`. */
  training: readonly TrainingSession[];
  overrides: Overrides;
}

export type MissingInput = 'sex' | 'birthDate' | 'height' | 'weight' | 'activity';
export type InvalidInput = 'age' | 'height' | 'weight';
export type CalculationWarning =
  | 'deficit-limited'
  | 'deficit-minimum'
  | 'surplus-limited'
  | 'carbs-low'
  | 'carbs-critical'
  | 'carbs-high'
  | 'weight-not-recent'
  | 'target-weight-low'
  | 'target-weight-direction'
  | 'manual-energy-low';

export interface Calculation {
  version: number;
  onDate: string;
  /** `complete`: every value could be calculated automatically. */
  status: 'complete' | 'incomplete';
  missing: MissingInput[];
  invalid: InvalidInput[];
  inputs: {
    sex: Sex | null;
    ageYears: number | null;
    heightCm: number | null;
    weight: WeightTrend | null;
    activityLevel: ActivityLevel | null;
    activityFactor: number | null;
    includeTraining: boolean;
    goalType: GoalType;
    goalLevel: GoalLevel | null;
    targetWeightKg: number | null;
  };
  energy: {
    rmrKcal: number;
    everydayKcal: number;
    /** `null` when training is not included. */
    training: TrainingEstimate | null;
    maintenanceKcal: number;
    adjustment: GoalAdjustment;
  } | null;
  protein: ProteinResult | null;
  /** Automatic values (given the manual ones they depend on, e.g. carbs on manual protein). */
  auto: MacroValues;
  /** Values that count: manual where set, otherwise automatic. */
  effective: MacroValues;
  manual: MacroValues;
  macros: { fatShare: number; carbsShare: number } | null;
  warnings: CalculationWarning[];
}

const round = (value: number, step: number) => Math.round(value / step) * step;
const finite = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const within = (value: number, range: { min: number; max: number }) =>
  value >= range.min && value <= range.max;

/** The level that applies to a goal type (a level of another goal type is ignored). */
export function levelFor(goalType: GoalType, level: GoalLevel | null): GoalLevel | null {
  const allowed: readonly GoalLevel[] = GOAL_LEVELS[goalType];
  if (allowed.length === 0) return null;
  return level && allowed.includes(level) ? level : 'moderate';
}

/**
 * The whole calculation in one place: weight trend → RMR → everyday activity → training →
 * maintenance → goal adjustment with safety bounds → protein → fat → carbohydrates.
 * Pure and deterministic; it never returns NaN or Infinity – missing or implausible inputs are
 * reported instead.
 */
export function calculateNutrition(input: CalculationInput): Calculation {
  const { personal, params, onDate } = input;
  const goalLevel = levelFor(params.goalType, params.goalLevel);
  const missing: MissingInput[] = [];
  const invalid: InvalidInput[] = [];
  const warnings: CalculationWarning[] = [];

  const ageYears = personal.birthDate ? ageOn(personal.birthDate, onDate) : null;
  if (!personal.sex) missing.push('sex');
  if (!personal.birthDate) missing.push('birthDate');
  else if (ageYears === null || !within(ageYears, INPUT_LIMITS.ageYears)) invalid.push('age');
  if (!finite(personal.heightCm)) missing.push('height');
  else if (!within(personal.heightCm, INPUT_LIMITS.heightCm)) invalid.push('height');
  const weight = weightTrend(input.weights, onDate);
  if (!weight) missing.push('weight');
  else if (!within(weight.kg, INPUT_LIMITS.weightKg)) invalid.push('weight');
  if (!params.activityLevel) missing.push('activity');
  if (weight?.method === 'latest') warnings.push('weight-not-recent');

  const heightOk = finite(personal.heightCm) && !invalid.includes('height');
  const weightOk = weight !== null && !invalid.includes('weight');
  const manual: MacroValues = {
    energyKcal: finite(input.overrides.energyKcal) ? input.overrides.energyKcal : null,
    proteinG: finite(input.overrides.proteinG) ? input.overrides.proteinG : null,
    carbsG: finite(input.overrides.carbsG) ? input.overrides.carbsG : null,
    fatG: finite(input.overrides.fatG) ? input.overrides.fatG : null,
  };
  const auto: MacroValues = { energyKcal: null, proteinG: null, carbsG: null, fatG: null };

  // Training data are read once; whether they count towards energy is the user's choice.
  const training = weightOk ? trainingEnergy(input.training, weight.kg) : null;

  // Energy needs every personal input.
  let energy: Calculation['energy'] = null;
  if (
    missing.length === 0 &&
    invalid.length === 0 &&
    weight &&
    personal.sex &&
    params.activityLevel &&
    finite(personal.heightCm) &&
    ageYears !== null
  ) {
    const rmrKcal = restingEnergy({
      sex: personal.sex,
      weightKg: weight.kg,
      heightCm: personal.heightCm,
      ageYears,
    });
    const everydayKcal = everydayEnergy(rmrKcal, params.activityLevel);
    const counted = params.includeTraining ? training : null;
    const maintenanceKcal = everydayKcal + (counted?.kcalPerDay ?? 0);
    const adjustment = adjustForGoal(maintenanceKcal, rmrKcal, params.goalType, goalLevel);
    if (adjustment.limitedBy === 'deficit-share') warnings.push('deficit-limited');
    if (adjustment.limitedBy === 'minimum') warnings.push('deficit-minimum');
    if (adjustment.limitedBy === 'surplus-cap') warnings.push('surplus-limited');
    energy = { rmrKcal, everydayKcal, training: counted, maintenanceKcal, adjustment };
    auto.energyKcal = round(adjustment.targetKcal, ROUNDING.kcal);
  }

  // Protein needs weight, height (reference weight) and activity – not sex or age.
  let protein: ProteinResult | null = null;
  if (weightOk && heightOk && finite(personal.heightCm) && params.activityLevel) {
    protein = proteinTarget({
      weightKg: weight.kg,
      heightCm: personal.heightCm,
      goalType: params.goalType,
      activityLevel: params.activityLevel,
      regularStrengthTraining:
        (training?.strengthSessions ?? 0) >= TRAINING.regularStrengthSessions,
    });
    auto.proteinG = round(protein.grams, ROUNDING.grams);
  }

  // Fat and carbohydrates follow from the energy and protein that count.
  const energyKcal = manual.energyKcal ?? auto.energyKcal;
  const proteinG = manual.proteinG ?? auto.proteinG;
  let macros: Calculation['macros'] = null;
  if (energyKcal !== null && proteinG !== null) {
    auto.fatG = round(splitMacros({ energyKcal, proteinG }).fatG, ROUNDING.grams);
    const fatG = manual.fatG ?? auto.fatG;
    const carbs = splitMacros({ energyKcal, proteinG, fatG });
    auto.carbsG = round(carbs.carbsG, ROUNDING.grams);
    const carbsG = manual.carbsG ?? auto.carbsG;
    const carbsShare = energyKcal > 0 ? (carbsG * 4) / energyKcal : 0;
    macros = { fatShare: energyKcal > 0 ? (fatG * 9) / energyKcal : 0, carbsShare };
    if (manual.carbsG === null) {
      if (carbs.carbsStatus === 'critical') warnings.push('carbs-critical');
      else if (carbs.carbsStatus === 'low') warnings.push('carbs-low');
      else if (carbs.carbsStatus === 'high') warnings.push('carbs-high');
    }
  }
  if (manual.energyKcal !== null && manual.energyKcal < MIN_ENERGY_KCAL) {
    warnings.push('manual-energy-low');
  }

  // Target weight: plausibility only – it never replaces the measured weight.
  const target = params.targetWeightKg;
  if (finite(target)) {
    if (heightOk && finite(personal.heightCm)) {
      const bmi = target / (personal.heightCm / 100) ** 2;
      if (bmi < MIN_TARGET_BMI) warnings.push('target-weight-low');
    }
    if (weight) {
      if (
        (params.goalType === 'lose' && target >= weight.kg) ||
        (params.goalType === 'gain' && target <= weight.kg)
      ) {
        warnings.push('target-weight-direction');
      }
    }
  }

  const effective: MacroValues = {
    energyKcal: manual.energyKcal ?? auto.energyKcal,
    proteinG: manual.proteinG ?? auto.proteinG,
    carbsG: manual.carbsG ?? auto.carbsG,
    fatG: manual.fatG ?? auto.fatG,
  };

  return {
    version: CALCULATION_VERSION,
    onDate,
    status: energy && protein ? 'complete' : 'incomplete',
    missing,
    invalid,
    inputs: {
      sex: personal.sex,
      ageYears,
      heightCm: finite(personal.heightCm) ? personal.heightCm : null,
      weight,
      activityLevel: params.activityLevel,
      activityFactor: params.activityLevel ? ACTIVITY_FACTORS[params.activityLevel] : null,
      includeTraining: params.includeTraining,
      goalType: params.goalType,
      goalLevel,
      targetWeightKg: finite(target) ? target : null,
    },
    energy,
    protein,
    auto,
    effective,
    manual,
    macros,
    warnings,
  };
}
