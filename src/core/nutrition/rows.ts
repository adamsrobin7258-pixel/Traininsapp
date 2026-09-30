import type { SqlValue } from '@/core/database';
import type { Nutrients } from './nutrients';

/** Column block shared by foods and food entries. */
export interface NutrientRow {
  energy_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  saturated_fat_g: number | null;
}

export const NUTRIENT_COLUMNS =
  'energy_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g';

export const toNutrients = (row: NutrientRow): Nutrients => ({
  energyKcal: row.energy_kcal,
  proteinG: row.protein_g,
  carbsG: row.carbs_g,
  fatG: row.fat_g,
  fiberG: row.fiber_g,
  sugarG: row.sugar_g,
  saturatedFatG: row.saturated_fat_g,
});

export const nutrientParams = (n: Nutrients): SqlValue[] => [
  n.energyKcal,
  n.proteinG,
  n.carbsG,
  n.fatG,
  n.fiberG,
  n.sugarG,
  n.saturatedFatG,
];

export const bool = (value: number) => value === 1;
