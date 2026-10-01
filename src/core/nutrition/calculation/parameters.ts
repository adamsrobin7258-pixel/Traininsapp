/**
 * Central parameters of the nutrition calculation (see docs/NUTRITION_CALCULATION.md).
 *
 * Two kinds of values live here and are marked as such:
 * - EVIDENCE: taken from published equations or reference values.
 * - PRODUCT: chosen by Kalethra within the evidence, conservative by intent. They can be tuned
 *   here without touching the calculation code; tests pin the current choices.
 */

/** Bump when a parameter or the calculation changes; stored with every calculation. */
export const CALCULATION_VERSION = 1;

export const SEXES = ['male', 'female', 'unspecified'] as const;
export type Sex = (typeof SEXES)[number];

/**
 * EVIDENCE – Mifflin-St Jeor (1990): RMR = 10·kg + 6.25·cm − 5·age + s, with s = +5 (male)
 * and −161 (female).
 * PRODUCT – for "unspecified" the mean of both constants (−78) is used, so no sex is assumed.
 */
export const MIFFLIN = {
  perKg: 10,
  perCm: 6.25,
  perYear: -5,
  constant: { male: 5, female: -161, unspecified: -78 } satisfies Record<Sex, number>,
} as const;

/** PRODUCT – the equation is validated for adults only; inputs outside are not calculated. */
export const INPUT_LIMITS = {
  ageYears: { min: 18, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 300 },
  targetWeightKg: { min: 30, max: 300 },
} as const;

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'veryActive'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/**
 * PRODUCT – everyday activity WITHOUT sport (job, chores, walking around), as a factor on the
 * RMR. Values follow the lower physical-activity-level bands (≈1.2 bed/desk-bound … ≈1.7 heavy
 * manual work, FAO/WHO/UNU 2004); sport is added separately from logged workouts, so it is
 * never counted twice.
 */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.3,
  moderate: 1.4,
  active: 1.55,
  veryActive: 1.7,
};

/** Training families as reported by the training module. */
export const TRAINING_CATEGORIES = [
  'strength',
  'endurance',
  'hybrid',
  'flexibility',
  'other',
] as const;
export type TrainingCategory = (typeof TRAINING_CATEGORIES)[number];

/**
 * EVIDENCE – MET values from the Compendium of Physical Activities (2024), lower/moderate
 * entries for each family (e.g. resistance training, multiple exercises: 3.5 MET).
 * PRODUCT – only the net part above rest (MET − 1) is added, because the RMR × activity factor
 * already covers the time spent training as everyday time.
 */
export const TRAINING_MET: Record<TrainingCategory, number> = {
  strength: 3.5,
  endurance: 6,
  hybrid: 6,
  flexibility: 2.3,
  other: 3.5,
};

/** PRODUCT – training is averaged over this many days and bounded to stay conservative. */
export const TRAINING = {
  windowDays: 28,
  maxMinutesPerSession: 180,
  maxKcalPerDay: 800,
  /** Strength sessions in the window that count as "regular strength training" (≈1/week). */
  regularStrengthSessions: 4,
} as const;

export const GOAL_LEVELS = {
  lose: ['slow', 'moderate', 'fast'],
  maintain: [],
  gain: ['moderate', 'higher'],
} as const;
export type LoseLevel = (typeof GOAL_LEVELS.lose)[number];
export type GainLevel = (typeof GOAL_LEVELS.gain)[number];
export type GoalLevel = LoseLevel | GainLevel;

/** EVIDENCE (approximation) – about 7,700 kcal per kg of body weight change. */
export const KCAL_PER_KG_BODY_WEIGHT = 7700;

/**
 * PRODUCT – daily deficit per level: ≈0.25 / 0.5 / 0.75 kg per week (7700 kcal/kg ÷ 7).
 * Never more than `maxDeficitShare` of maintenance.
 */
export const DEFICIT_KCAL: Record<LoseLevel, number> = { slow: 275, moderate: 550, fast: 825 };
export const MAX_DEFICIT_SHARE = 0.25;

/** PRODUCT – conservative surplus as a share of maintenance, with an upper bound in kcal. */
export const SURPLUS: Record<GainLevel, { share: number; maxKcal: number }> = {
  moderate: { share: 0.05, maxKcal: 250 },
  higher: { share: 0.1, maxKcal: 500 },
};

/**
 * PRODUCT – safety floor: a target never goes below the estimated RMR nor below this absolute
 * minimum; a smaller result is raised and the user is told why.
 */
export const MIN_ENERGY_KCAL = 1200;

/**
 * Protein in g per kg reference weight.
 * EVIDENCE – active people/strength training ≈1.4–2.0 g/kg/day (ISSN 2017); in an energy
 * deficit with resistance training higher intakes (up to ≈2.2 g/kg) support lean mass.
 * PRODUCT – the concrete steps below and the cap.
 */
export const PROTEIN_G_PER_KG = {
  /** Without regular strength training, by everyday activity. */
  base: { low: 1.2, high: 1.4 },
  /** Extra for a goal when not strength training. */
  goalBonus: { lose: 0.2, maintain: 0, gain: 0.2 },
  /** With regular strength training. */
  strength: { lose: 2.0, maintain: 1.6, gain: 1.8 },
  max: 2.2,
} as const;

/**
 * PRODUCT – protein is based on the trend weight, but for a BMI above this value on the weight
 * at this BMI, so high body weight does not lead to excessive protein targets.
 */
export const PROTEIN_REFERENCE_MAX_BMI = 27.5;

/**
 * EVIDENCE – reference ranges for adults: fat 20–35 %, carbohydrates 45–60 % of energy
 * (DGE/EFSA). PRODUCT – fat starts at 30 % and may go down to 25 % so carbohydrates stay
 * closer to their range when protein is high.
 */
export const FAT_SHARE = { default: 0.3, min: 0.25, reference: { min: 0.2, max: 0.35 } } as const;
export const CARB_SHARE_REFERENCE = { min: 0.45, max: 0.6 } as const;
/** PRODUCT – below this share the result is flagged clearly, not only informationally. */
export const CARB_SHARE_CRITICAL = 0.25;

/** EVIDENCE – Atwater factors. */
export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/**
 * PRODUCT – weight trend: median of the entries of the last 7 days (robust against a single
 * outlier). A new automatic goal is stored only when the trend moved at least this much, or the
 * calorie target moved at least `minEnergyChangeKcal` (e.g. through training or age).
 */
export const WEIGHT_TREND = {
  windowDays: 7,
  minChangeKg: 0.5,
  minEnergyChangeKcal: 50,
} as const;

/** PRODUCT – plausible target weights are at least this BMI; lower ones are flagged. */
export const MIN_TARGET_BMI = 18.5;

/** Display rounding of results. */
export const ROUNDING = { kcal: 10, grams: 1 } as const;
