import type { ExerciseType } from './exercise';
import type { WorkoutSet } from './sets';

/**
 * Central, pure training metrics. Prepared for records and statistics; the UI shows only a
 * small part of it for now.
 */

/**
 * Volume of one set in kilograms: load × repetitions, completed sets only.
 * Bodyweight exercises count only the added load (body weight is not known per set).
 */
export function setVolumeKg(set: Pick<WorkoutSet, 'weightKg' | 'reps' | 'completed'>): number {
  if (!set.completed || set.weightKg === null || set.reps === null) return 0;
  return set.weightKg * set.reps;
}

export function totalVolumeKg(
  sets: readonly Pick<WorkoutSet, 'weightKg' | 'reps' | 'completed'>[],
) {
  return sets.reduce((sum, set) => sum + setVolumeKg(set), 0);
}

/**
 * Estimated one-repetition maximum (Epley). Only meaningful for loaded sets of 1–12 reps;
 * returns `null` otherwise instead of an unreliable number.
 */
export function estimateOneRepMaxKg(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || !Number.isInteger(reps) || reps < 1 || reps > 12) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

export interface ExercisePerformance {
  heaviestKg: number | null;
  mostReps: number | null;
  bestEstimatedOneRepMaxKg: number | null;
  volumeKg: number;
  completedSets: number;
}

/** Aggregates completed sets of one exercise, e.g. for later personal records. */
export function summarizeSets(
  sets: readonly WorkoutSet[],
  type: ExerciseType,
): ExercisePerformance {
  const done = sets.filter((set) => set.completed);
  const loads = done.map((set) => set.weightKg).filter((w): w is number => w !== null);
  const reps = done.map((set) => set.reps).filter((r): r is number => r !== null);
  const estimates =
    type === 'weighted'
      ? done
          .map((set) =>
            set.weightKg !== null && set.reps !== null
              ? estimateOneRepMaxKg(set.weightKg, set.reps)
              : null,
          )
          .filter((e): e is number => e !== null)
      : [];
  return {
    heaviestKg: loads.length ? Math.max(...loads) : null,
    mostReps: reps.length ? Math.max(...reps) : null,
    bestEstimatedOneRepMaxKg: estimates.length ? Math.max(...estimates) : null,
    volumeKg: totalVolumeKg(done),
    completedSets: done.length,
  };
}
