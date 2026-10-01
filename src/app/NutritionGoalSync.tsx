import { useEffect, useRef } from 'react';
import { useWeightService } from '@/core/health';
import { useNutrition } from '@/core/nutrition';
import { useTraining } from '@/core/training';
import { useProfile } from '@/core/user';

/**
 * Keeps automatic nutrition goals in step with their sources: after a weight, workout or body
 * data change the goal service re-calculates today's values. It stores a new version only when
 * the change is relevant (see GoalService.refreshAutomatic), never touches manual values and
 * never changes past days. Lives in the app layer because it connects separate areas.
 */
export function NutritionGoalSync() {
  const { revision: weightRevision } = useWeightService();
  const { revision: trainingRevision } = useTraining();
  const { profile } = useProfile();
  const { mutate } = useNutrition();
  const first = useRef(true);

  useEffect(() => {
    // The app start already refreshed (loadInitialState).
    if (first.current) {
      first.current = false;
      return;
    }
    mutate((s, profileId) => s.goals.refreshAutomatic(profileId)).catch(() => {
      // A failed refresh keeps the stored goal; it is retried with the next change.
    });
  }, [weightRevision, trainingRevision, profile.updatedAt, mutate]);

  return null;
}
