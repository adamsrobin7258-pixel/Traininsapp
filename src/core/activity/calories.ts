import type { Intensity, MetValue, SportDefinition, VariantOption } from './catalog';

/**
 * Energy of a manually logged activity. Pure and deterministic.
 *
 * Formula (net active energy, like Health Connect's "active calories"):
 *
 *   kcal = (MET − 1) × 3.5 × body weight (kg) ÷ 200 × duration (min)
 *
 * MET × 3.5 ml O₂/kg/min is the oxygen uptake of the activity, ÷ 200 converts ml O₂ × kg into
 * kcal (≈ 5 kcal per litre O₂). The resting part (1 MET) is left out: the daily calorie goal
 * already contains resting energy for those minutes (RMR × activity factor), and Health Connect
 * reports active calories the same way. Kalethra's own training estimate uses the same rule.
 * See docs/ACTIVITIES.md.
 */

export const CALORIE_METHOD = 'met-net-v1';

/** Input the calculation needs; `distanceM` only counts where the sport uses speed bands. */
export interface MetInput {
  durationS: number;
  distanceM: number | null;
  intensity: Intensity | null;
  variant: VariantOption | null;
}

export interface ResolvedMet extends MetValue {
  /** Speed used to pick a band, km/h (only for speed-based sports with a distance). */
  speedKmh: number | null;
}

/** The MET value for the entered data – fixed, by intensity, variant or speed. */
export function resolveMet(sport: SportDefinition, input: MetInput): ResolvedMet {
  const model = sport.met;
  switch (model.kind) {
    case 'fixed':
      return { ...model.value, speedKmh: null };
    case 'intensity': {
      const level =
        (input.intensity && model.levels[input.intensity]) ?? model.levels[model.default];
      if (!level) throw new Error(`no MET for ${sport.id}`);
      return { ...level, speedKmh: null };
    }
    case 'variant': {
      const options = model.options;
      const chosen = input.variant ? options[input.variant] : undefined;
      const fallback = Object.values(options)[0];
      const value = chosen ?? fallback;
      if (!value) throw new Error(`no MET for ${sport.id}`);
      return { ...value, speedKmh: null };
    }
    case 'speed': {
      if (input.distanceM !== null && input.distanceM > 0 && input.durationS > 0) {
        const speedKmh = input.distanceM / 1000 / (input.durationS / 3600);
        const band = [...model.bands].reverse().find((entry) => speedKmh >= entry.fromKmh);
        if (band) return { ...band.value, speedKmh: Math.round(speedKmh * 10) / 10 };
      }
      const level = input.intensity && model.levels ? model.levels[input.intensity] : undefined;
      return { ...(level ?? model.fallback), speedKmh: null };
    }
  }
}

/** Active (net) kcal, rounded to whole kcal; never negative. */
export function activeKcal(met: number, weightKg: number, durationS: number): number {
  const minutes = durationS / 60;
  const kcal = (Math.max(0, met - 1) * 3.5 * weightKg * minutes) / 200;
  return Math.round(kcal);
}

export interface CalorieEstimate {
  /** `null` without a body weight – nothing is guessed. */
  kcal: number | null;
  met: ResolvedMet;
  weightKg: number | null;
}

export function estimateCalories(
  sport: SportDefinition,
  input: MetInput,
  weightKg: number | null,
): CalorieEstimate {
  const met = resolveMet(sport, input);
  return {
    met,
    weightKg,
    kcal: weightKg !== null && weightKg > 0 ? activeKcal(met.met, weightKg, input.durationS) : null,
  };
}
