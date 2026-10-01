import { migration001Initial } from './001_initial';
import { migration002Diagnostics } from './002_diagnostics';
import { migration003WeightEntries } from './003_weight_entries';
import { migration004Training } from './004_training';
import { migration005SetTypes } from './005_set_types';
import { migration006Nutrition } from './006_nutrition';
import { migration007NutritionProfile } from './007_nutrition_profile';
import { migration008FoodOrigin } from './008_food_origin';
import { migration009ExerciseFavorites } from './009_exercise_favorites';
import { migration010HealthImport } from './010_health_import';
import type { Migration } from './types';

/** All migrations in ascending order. Append new migrations at the end. */
export const migrations: readonly Migration[] = [
  migration001Initial,
  migration002Diagnostics,
  migration003WeightEntries,
  migration004Training,
  migration005SetTypes,
  migration006Nutrition,
  migration007NutritionProfile,
  migration008FoodOrigin,
  migration009ExerciseFavorites,
  migration010HealthImport,
];

export type { Migration } from './types';
