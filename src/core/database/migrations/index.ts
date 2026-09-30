import { migration001Initial } from './001_initial';
import { migration002Diagnostics } from './002_diagnostics';
import { migration003WeightEntries } from './003_weight_entries';
import { migration004Training } from './004_training';
import { migration005SetTypes } from './005_set_types';
import { migration006Nutrition } from './006_nutrition';
import type { Migration } from './types';

/** All migrations in ascending order. Append new migrations at the end. */
export const migrations: readonly Migration[] = [
  migration001Initial,
  migration002Diagnostics,
  migration003WeightEntries,
  migration004Training,
  migration005SetTypes,
  migration006Nutrition,
];

export type { Migration } from './types';
