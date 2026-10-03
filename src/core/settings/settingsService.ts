import type { SettingsRepository } from './settingsRepository';
import {
  DEFAULT_SETTINGS,
  isValidWaterQuickAmounts,
  LANGUAGE_PREFERENCES,
  THEME_PREFERENCES,
  WEIGHT_UNIT_PREFERENCES,
  type AppSettings,
} from './types';

type Validators = { [K in keyof AppSettings]: (value: unknown) => value is AppSettings[K] };

function oneOf<T extends string>(allowed: readonly T[]) {
  return (value: unknown): value is T => allowed.includes(value as T);
}

const validators: Validators = {
  theme: oneOf(THEME_PREFERENCES),
  language: oneOf(LANGUAGE_PREFERENCES),
  weightUnit: oneOf(WEIGHT_UNIT_PREFERENCES),
  waterQuickAmountsMl: isValidWaterQuickAmounts,
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
