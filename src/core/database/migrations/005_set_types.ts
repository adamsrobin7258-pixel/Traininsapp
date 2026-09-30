import type { Migration } from './types';

/**
 * Set types: warm-up sets and drop sets as real training data.
 *
 * Purely additive – existing rows keep all values and read as ordinary working sets
 * (`set_type` defaults to 'working', `drop_of` to NULL):
 * - workout_sets.set_type: 'warmup' | 'working' | 'drop'
 * - workout_sets.drop_of: the working set a drop belongs to. The drops of one set form a chain
 *   ordered by `position`; deleting the working set deletes its drops.
 * - planned_exercises.warmup_sets / drop_sets: warm-up sets before and drops after the last
 *   working set, copied into the workout when it is started from the plan.
 */
export const migration005SetTypes: Migration = {
  version: 5,
  name: 'set_types',
  up: `
    ALTER TABLE workout_sets ADD COLUMN set_type TEXT NOT NULL DEFAULT 'working'
      CHECK (set_type IN ('warmup', 'working', 'drop'));
    ALTER TABLE workout_sets ADD COLUMN drop_of TEXT
      REFERENCES workout_sets(id) ON DELETE CASCADE
      CHECK ((set_type = 'drop') = (drop_of IS NOT NULL));
    CREATE INDEX workout_sets_drop_of ON workout_sets (drop_of);

    ALTER TABLE planned_exercises ADD COLUMN warmup_sets INTEGER
      CHECK (warmup_sets BETWEEN 1 AND 10);
    ALTER TABLE planned_exercises ADD COLUMN drop_sets INTEGER
      CHECK (drop_sets BETWEEN 1 AND 5);
  `,
};
