import { useTrainingData } from '@/core/training';
import { ExerciseDetailSheet } from './ExerciseDetailSheet';

/**
 * The existing exercise details (with "Deine Leistung") opened from the training context, e.g.
 * a finished workout. Loads the exercise and its favourite state; nothing else is calculated.
 */
export function ExerciseDetailById({
  exerciseId,
  onClose,
}: {
  exerciseId: string;
  onClose: () => void;
}) {
  const data = useTrainingData(
    async (s, profileId) => {
      const [exercise, favoriteIds] = await Promise.all([
        s.exercises.get(exerciseId),
        s.exercises.favoriteIds(profileId),
      ]);
      return exercise ? { exercise, favorite: favoriteIds.includes(exercise.id) } : null;
    },
    [exerciseId],
  );
  if (data.status !== 'ready' || !data.data) return null;
  return (
    <ExerciseDetailSheet
      exercise={data.data.exercise}
      favorite={data.data.favorite}
      onClose={onClose}
    />
  );
}
