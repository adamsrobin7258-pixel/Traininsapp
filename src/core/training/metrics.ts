import type { ExerciseType } from './exercise';
import type { SetType, WorkoutSet } from './sets';

/**
 * Central, pure training metrics. Prepared for records and statistics; the UI shows only a
 * small part of it for now.
 */

type VolumeSet = Pick<WorkoutSet, 'weightKg' | 'reps' | 'completed'> & { setType?: SetType };

/**
 * Volume of one set in kilograms: load × repetitions, completed sets only. Working sets and
 * their drops count; warm-up sets do not (they prepare, they are not training volume).
 * Bodyweight exercises count only the added load (body weight is not known per set).
 */
export function setVolumeKg(set: VolumeSet): number {
  if (set.setType === 'warmup') return 0;
  if (!set.completed || set.weightKg === null || set.reps === null) return 0;
  return set.weightKg * set.reps;
}

export function totalVolumeKg(sets: readonly VolumeSet[]) {
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

/**
 * Aggregates completed sets of one exercise, e.g. for later personal records. Records and the
 * set count consider working sets only; drops add to the volume; warm-ups are ignored.
 */
export function summarizeSets(
  sets: readonly WorkoutSet[],
  type: ExerciseType,
): ExercisePerformance {
  const completed = sets.filter((set) => set.completed);
  const done = completed.filter((set) => set.setType === 'working');
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
    volumeKg: totalVolumeKg(completed),
    completedSets: done.length,
  };
}
