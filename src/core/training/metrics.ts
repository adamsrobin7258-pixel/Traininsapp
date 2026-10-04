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

// ── Performance of one exercise over time ─────────────────────────────────────

/** One set as it counts for performance: loaded, with repetitions, of one completed workout. */
type PerformanceInputSet = Pick<WorkoutSet, 'weightKg' | 'reps' | 'completed' | 'setType'>;

/** The completed sets of an exercise in one completed workout. */
export interface PerformanceSession {
  workoutId: string;
  localDate: string;
  sets: readonly PerformanceInputSet[];
}

/** The strongest set of a workout: the highest estimated maximum. */
export interface PerformanceSet {
  workoutId: string;
  localDate: string;
  weightKg: number;
  reps: number;
  estimatedOneRepMaxKg: number;
}

export type PerformanceTrend = 'up' | 'down' | 'steady';

export interface ExerciseProgress {
  /** Strongest set of all workouts (the earliest one when several are equal). */
  best: PerformanceSet | null;
  /** Strongest set of the most recent workout with a rateable set. */
  latest: PerformanceSet | null;
  /** The most recent workout set the best (and there were earlier ones to beat). */
  latestIsBest: boolean;
  /** Latest workout against the ones before it; `null` without an earlier one. */
  trend: PerformanceTrend | null;
  /** Workouts with at least one rateable set. */
  sessions: number;
}

/**
 * PRODUCT – the latest workout is compared with the mean of this many workouts before it, so a
 * single weak or strong day does not flip the trend; changes below the threshold are "steady".
 */
export const PERFORMANCE_TREND = { compareSessions: 3, threshold: 0.025 } as const;

/**
 * The strongest set of one workout: completed working sets with a load and 1–12 repetitions
 * (the range in which the Epley estimate is meaningful). Warm-ups, drops, unloaded sets and
 * high-rep sets never count – they would give misleading maxima. Equal estimates: the heavier set.
 */
export function strongestSet(session: PerformanceSession): PerformanceSet | null {
  let strongest: PerformanceSet | null = null;
  for (const set of session.sets) {
    if (!set.completed || set.setType !== 'working') continue;
    if (set.weightKg === null || set.reps === null) continue;
    const estimate = estimateOneRepMaxKg(set.weightKg, set.reps);
    if (estimate === null) continue;
    const better =
      !strongest ||
      estimate > strongest.estimatedOneRepMaxKg ||
      (estimate === strongest.estimatedOneRepMaxKg && set.weightKg > strongest.weightKg);
    if (better) {
      strongest = {
        workoutId: session.workoutId,
        localDate: session.localDate,
        weightKg: set.weightKg,
        reps: set.reps,
        estimatedOneRepMaxKg: estimate,
      };
    }
  }
  return strongest;
}

/**
 * Best, latest and direction of one weighted exercise. `sessions` oldest first. Pure: the same
 * history always gives the same result; nothing is stored.
 */
export function exerciseProgress(sessions: readonly PerformanceSession[]): ExerciseProgress {
  const rated = sessions.flatMap((session) => {
    const set = strongestSet(session);
    return set ? [set] : [];
  });
  let best: PerformanceSet | null = null;
  for (const set of rated) {
    if (!best || set.estimatedOneRepMaxKg > best.estimatedOneRepMaxKg) best = set;
  }
  const latest = rated.at(-1) ?? null;
  const earlier = rated.slice(-1 - PERFORMANCE_TREND.compareSessions, -1);
  let trend: PerformanceTrend | null = null;
  if (latest && earlier.length > 0) {
    const reference =
      earlier.reduce((sum, set) => sum + set.estimatedOneRepMaxKg, 0) / earlier.length;
    const change = (latest.estimatedOneRepMaxKg - reference) / reference;
    trend =
      change > PERFORMANCE_TREND.threshold
        ? 'up'
        : change < -PERFORMANCE_TREND.threshold
          ? 'down'
          : 'steady';
  }
  return {
    best,
    latest,
    latestIsBest: rated.length > 1 && best !== null && best === latest,
    trend,
    sessions: rated.length,
  };
}
