export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const LANGUAGE_PREFERENCES = ['system', 'de', 'en'] as const;
export type LanguagePreference = (typeof LANGUAGE_PREFERENCES)[number];

export const WEIGHT_UNIT_PREFERENCES = ['kg', 'lb'] as const;
export type WeightUnitPreference = (typeof WEIGHT_UNIT_PREFERENCES)[number];

/**
 * Weight increase suggestions in training (Einstellungen → Ziele → Training). Only a hint: the
 * user always decides. The rules per mode live in core/training/progression.ts.
 */
export const PROGRESSION_MODES = ['off', 'cautious', 'normal', 'progressive'] as const;
export type ProgressionMode = (typeof PROGRESSION_MODES)[number];

/** Rest timer after a completed set, in seconds (Einstellungen → App → Training); 0 = off. */
export const REST_TIMER_OPTIONS_S = [0, 30, 60, 90, 120, 180, 240, 300] as const;
export type RestTimerSeconds = (typeof REST_TIMER_OPTIONS_S)[number];

/** Quick buttons for logging water: 1–4 amounts in millilitres, each 10–5000 ml. */
export const WATER_QUICK_AMOUNTS_MAX = 4;
export const WATER_QUICK_AMOUNT_LIMITS = { min: 10, max: 5000 } as const;

export function isValidWaterQuickAmounts(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= WATER_QUICK_AMOUNTS_MAX &&
    value.every(
      (amount) =>
        Number.isInteger(amount) &&
        (amount as number) >= WATER_QUICK_AMOUNT_LIMITS.min &&
        (amount as number) <= WATER_QUICK_AMOUNT_LIMITS.max,
    )
  );
}

export interface AppSettings {
  theme: ThemePreference;
  language: LanguagePreference;
  /** Display and input unit for body weight; storage is always kilograms. */
  weightUnit: WeightUnitPreference;
  /** Amounts of the water quick buttons (ml), in display order. */
  waterQuickAmountsMl: number[];
  /** Suggest a weight increase once a load was held for long enough (see progression.ts). */
  progressionMode: ProgressionMode;
  /** Rest timer started after a completed set; 0 shows no timer at all. */
  restTimerSeconds: RestTimerSeconds;
  // "Aktivitätskalorien anrechnen" is no setting: it is a versioned target (core/targets, kind
  // `activityCalories`), so switching it never changes the goals of past days.
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'system',
  weightUnit: 'kg',
  waterQuickAmountsMl: [250, 500, 750],
  progressionMode: 'normal',
  restTimerSeconds: 90,
};
