import { useMemo } from 'react';
import { useI18n } from '@/core/i18n';
import {
  exerciseSearchIndex,
  useTrainingData,
  type Exercise,
  type TrainingLoadState,
  type ExerciseSearchEntry,
} from '@/core/training';

export interface ExerciseLibrary {
  exercises: Exercise[];
  /** Search keys, built once per load and language instead of on every keystroke. */
  index: ExerciseSearchEntry[];
  favoriteIds: ReadonlySet<string>;
  favorites: Exercise[];
  recent: Exercise[];
}

/** Exercises with favourites and recently used ones, ready for searching and filtering. */
export function useExerciseLibrary({
  includeInactive = false,
}: { includeInactive?: boolean } = {}): TrainingLoadState<ExerciseLibrary> {
  const { locale } = useI18n();
  const data = useTrainingData(
    async (s, profileId) => {
      const [exercises, favoriteIds, recentIds] = await Promise.all([
        s.exercises.list(profileId, { includeInactive }),
        s.exercises.favoriteIds(profileId),
        s.exercises.recentIds(profileId),
      ]);
      return { exercises, favoriteIds, recentIds };
    },
    [includeInactive],
  );

  return useMemo((): TrainingLoadState<ExerciseLibrary> => {
    if (data.status !== 'ready') return data;
    const { exercises, favoriteIds, recentIds } = data.data;
    const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    // Deactivated exercises are not offered as favourites or recent picks.
    const pick = (ids: string[]) =>
      ids.flatMap((id) => {
        const exercise = byId.get(id);
        return exercise?.active ? [exercise] : [];
      });
    return {
      status: 'ready',
      data: {
        exercises,
        index: exerciseSearchIndex(exercises, locale),
        favoriteIds: new Set(favoriteIds),
        favorites: pick(favoriteIds),
        recent: pick(recentIds),
      },
    };
  }, [data, locale]);
}
