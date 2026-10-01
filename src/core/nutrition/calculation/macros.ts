import type { GoalType } from '../goals';
import {
  CARB_SHARE_CRITICAL,
  CARB_SHARE_REFERENCE,
  FAT_SHARE,
  KCAL_PER_G,
  PROTEIN_G_PER_KG,
  PROTEIN_REFERENCE_MAX_BMI,
  type ActivityLevel,
} from './parameters';

export interface ProteinResult {
  gPerKg: number;
  referenceWeightKg: number;
  /** True when the reference weight was capped at the BMI limit. */
  referenceCapped: boolean;
  basis: 'strength' | 'activity';
  grams: number;
}

/**
 * Protein from body weight, goal and training – not as a share of calories. Regular strength
 * training raises the target (most in a deficit, to support lean mass); the cap avoids
 * unnecessarily extreme values.
 */
export function proteinTarget(input: {
  weightKg: number;
  heightCm: number;
  goalType: GoalType;
  activityLevel: ActivityLevel;
  regularStrengthTraining: boolean;
}): ProteinResult {
  const heightM = input.heightCm / 100;
  const cap = PROTEIN_REFERENCE_MAX_BMI * heightM * heightM;
  const referenceWeightKg = Math.min(input.weightKg, cap);
  const gPerKg = Math.min(
    input.regularStrengthTraining
      ? PROTEIN_G_PER_KG.strength[input.goalType]
      : (input.activityLevel === 'sedentary' || input.activityLevel === 'light'
          ? PROTEIN_G_PER_KG.base.low
          : PROTEIN_G_PER_KG.base.high) + PROTEIN_G_PER_KG.goalBonus[input.goalType],
    PROTEIN_G_PER_KG.max,
  );
  return {
    gPerKg: Math.round(gPerKg * 100) / 100,
    referenceWeightKg: Math.round(referenceWeightKg * 10) / 10,
    referenceCapped: referenceWeightKg < input.weightKg,
    basis: input.regularStrengthTraining ? 'strength' : 'activity',
    grams: gPerKg * referenceWeightKg,
  };
}

export interface MacroSplit {
  fatShare: number;
  fatG: number;
  carbsG: number;
  carbsShare: number;
  /** `low`: below the reference range; `critical`: very low or nothing left for carbs. */
  carbsStatus: 'ok' | 'low' | 'critical' | 'high';
}

/**
 * Fat and carbohydrates for an energy and protein amount. Fat starts at 30 % of energy and is
 * lowered to 25 % when that keeps carbohydrates nearer their reference range; carbohydrates
 * take the rest. Values given by the user (`fatG`) are respected.
 */
export function splitMacros(input: {
  energyKcal: number;
  proteinG: number;
  /** Fixed fat amount (manual value), otherwise calculated. */
  fatG?: number | null;
}): MacroSplit {
  const { energyKcal, proteinG } = input;
  const carbsFor = (fat: number) =>
    (energyKcal - proteinG * KCAL_PER_G.protein - fat * KCAL_PER_G.fat) / KCAL_PER_G.carbs;
  const share = (carbs: number) => (energyKcal > 0 ? (carbs * KCAL_PER_G.carbs) / energyKcal : 0);

  let fatG = input.fatG ?? (energyKcal * FAT_SHARE.default) / KCAL_PER_G.fat;
  if (input.fatG == null && share(carbsFor(fatG)) < CARB_SHARE_REFERENCE.min) {
    fatG = (energyKcal * FAT_SHARE.min) / KCAL_PER_G.fat;
  }
  const rawCarbs = carbsFor(fatG);
  const carbsG = Math.max(0, rawCarbs);
  const carbsShare = share(carbsG);
  const carbsStatus =
    rawCarbs <= 0 || carbsShare < CARB_SHARE_CRITICAL
      ? 'critical'
      : carbsShare < CARB_SHARE_REFERENCE.min
        ? 'low'
        : carbsShare > CARB_SHARE_REFERENCE.max
          ? 'high'
          : 'ok';
  return {
    fatShare: energyKcal > 0 ? (fatG * KCAL_PER_G.fat) / energyKcal : 0,
    fatG,
    carbsG,
    carbsShare,
    carbsStatus,
  };
}
