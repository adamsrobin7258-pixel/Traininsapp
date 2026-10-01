import { BACK } from './catalog/back';
import { BICEPS, FOREARMS, TRICEPS } from './catalog/arms';
import { CHEST } from './catalog/chest';
import { CORE, FULL_BODY } from './catalog/core';
import type { CatalogExercise } from './catalog/define';
import { CALVES, GLUTES, LEGS } from './catalog/legs';
import { SHOULDERS } from './catalog/shoulders';

export type { CatalogExercise } from './catalog/define';

/**
 * Bundled system exercises. Synced into the `exercises` table at startup when the version
 * changes (insert new, update existing, deactivate removed) – no migration needed to grow the
 * catalog. IDs are permanent: never rename or reuse one, because workouts and plans reference
 * them. Names may change (past workouts keep their own name snapshot); a former name should
 * then stay findable as an alias.
 *
 * Aliases are search terms only (e.g. "Bankdrücken", "RDL"). They are not stored in the
 * database and never create additional exercises.
 */
export const EXERCISE_CATALOG_VERSION = 2;

export const EXERCISE_CATALOG: readonly CatalogExercise[] = [
  ...CHEST,
  ...BACK,
  ...SHOULDERS,
  ...BICEPS,
  ...TRICEPS,
  ...FOREARMS,
  ...LEGS,
  ...GLUTES,
  ...CALVES,
  ...CORE,
  ...FULL_BODY,
];

const BY_ID = new Map<string, CatalogExercise>(EXERCISE_CATALOG.map((item) => [item.id, item]));

/** Search aliases of a system exercise; empty for user exercises and unknown IDs. */
export function exerciseAliases(id: string): readonly string[] {
  return BY_ID.get(id)?.aliases ?? [];
}
