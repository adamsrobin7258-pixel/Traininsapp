/**
 * A training plan describes what should be trained. It is never used to display history –
 * workouts keep their own snapshot (see workout.ts).
 */
export interface TrainingPlan {
  id: string;
  profileId: string;
  name: string;
  trainingType: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanDay {
  id: string;
  planId: string;
  name: string;
  position: number;
}

export interface PlannedExercise {
  id: string;
  dayId: string;
  exerciseId: string;
  position: number;
  /** Optional targets; no periodisation logic yet. `targetSets` counts working sets. */
  targetSets: number | null;
  targetReps: number | null;
  /** Warm-up sets before the working sets (`null` = none). */
  warmupSets: number | null;
  /** Drops after the last working set (`null` = none). */
  dropSets: number | null;
}

/** Everything that can be configured for a planned exercise; `null` means "not set". */
export type PlannedTargets = Pick<
  PlannedExercise,
  'targetSets' | 'targetReps' | 'warmupSets' | 'dropSets'
>;

export interface PlanDayWithExercises extends PlanDay {
  exercises: PlannedExercise[];
}

export interface PlanDetail extends TrainingPlan {
  days: PlanDayWithExercises[];
}

export const PLAN_NAME_MAX_LENGTH = 60;
export const TARGET_LIMITS = {
  sets: { min: 1, max: 20 },
  reps: { min: 1, max: 100 },
  warmupSets: { min: 1, max: 10 },
  dropSets: { min: 1, max: 5 },
} as const;

export interface NextPlanDay {
  planId: string;
  planName: string;
  dayId: string;
  dayName: string;
}

/**
 * Suggests the next day of a plan: the day after the last one trained (wrapping around), or
 * the first day if the plan has not been used yet. Returns `null` for a plan without days.
 */
export function nextPlanDay(
  plan: Pick<PlanDetail, 'id' | 'name' | 'days'>,
  lastTrainedDayId: string | null,
): NextPlanDay | null {
  const days = [...plan.days].sort((a, b) => a.position - b.position);
  if (days.length === 0) return null;
  const lastIndex = days.findIndex((day) => day.id === lastTrainedDayId);
  const next = days[(lastIndex + 1) % days.length] ?? days[0];
  if (!next) return null;
  return { planId: plan.id, planName: plan.name, dayId: next.id, dayName: next.name };
}

/** Moves the item at `index` by `delta` and returns the new order (positions are renumbered by the caller). */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return [...items];
  }
  const copy = [...items];
  const [item] = copy.splice(index, 1);
  if (item !== undefined) copy.splice(target, 0, item);
  return copy;
}
