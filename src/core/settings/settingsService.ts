import type { SettingsRepository } from './settingsRepository';
import {
  DEFAULT_SETTINGS,
  isValidWaterQuickAmounts,
  LANGUAGE_PREFERENCES,
  THEME_PREFERENCES,
  WEEKLY_TARGET_LIMITS,
  WEIGHT_UNIT_PREFERENCES,
  type AppSettings,
} from './types';

type Validators = { [K in keyof AppSettings]: (value: unknown) => value is AppSettings[K] };

/** A whole number within `limits`, or `null` for "no target". */
function optionalTarget(limits: { min: number; max: number }) {
  return (value: unknown): value is number | null =>
    value === null ||
    (Number.isInteger(value) && (value as number) >= limits.min && (value as number) <= limits.max);
}

function oneOf<T extends string>(allowed: readonly T[]) {
  return (value: unknown): value is T => allowed.includes(value as T);
}

const validators: Validators = {
  theme: oneOf(THEME_PREFERENCES),
  language: oneOf(LANGUAGE_PREFERENCES),
  weightUnit: oneOf(WEIGHT_UNIT_PREFERENCES),
  waterQuickAmountsMl: isValidWaterQuickAmounts,
  countActivityCalories: (value: unknown): value is boolean => typeof value === 'boolean',
  trainingsPerWeek: optionalTarget(WEEKLY_TARGET_LIMITS.trainingsPerWeek),
  activeMinutesPerWeek: optionalTarget(WEEKLY_TARGET_LIMITS.activeMinutesPerWeek),
};

/** Merges stored values with defaults. Unknown keys and invalid values are ignored. */
export function parseSettings(stored: ReadonlyMap<string, unknown>): AppSettings {
  const settings: AppSettings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(validators) as (keyof AppSettings)[]) {
    const value = stored.get(key);
    if (validators[key](value)) {
      Object.assign(settings, { [key]: Array.isArray(value) ? [...value] : value });
    }
  }
  return settings;
}

export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  async load(): Promise<AppSettings> {
    return parseSettings(await this.repository.getAll());
  }

  async update<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
    if (!validators[key](value)) {
      throw new Error(`Invalid value for setting "${key}"`);
    }
    await this.repository.set(key, value);
  }
}
