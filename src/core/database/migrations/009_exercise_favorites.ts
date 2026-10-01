import type { Migration } from './types';

/**
 * Favourite exercises per profile.
 *
 * A separate table because system exercises are shared by all profiles (no profile_id), so a
 * flag on the exercise row could not be personal. Purely additive – no existing row changes.
 * Recently used exercises need no table: they are derived from the workout history.
 */
export const migration009ExerciseFavorites: Migration = {
  version: 9,
  name: 'exercise_favorites',
  up: `
    CREATE TABLE exercise_favorites (
      profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      created_at  TEXT NOT NULL,
      PRIMARY KEY (profile_id, exercise_id)
    );
  `,
};
