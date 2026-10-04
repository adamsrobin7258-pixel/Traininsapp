import type { Clock } from '@/shared/lib/clock';
import { addDays, toLocalDateKey } from '@/shared/lib/date';
import { createId } from '@/shared/lib/id';
import { TrainingError } from './errors';
import { EXERCISE_TYPES, isOneOf, type Exercise } from './exercise';
import type { ProgressionMode } from '@/core/settings/types';
import type { WeightUnit } from '@/shared/lib/units';
import { exerciseProgress, type ExerciseProgress } from './metrics';
import { moveItem } from './plan';
import {
  PROGRESSION_MAX_SESSIONS,
  suggestProgression,
  type ProgressionSuggestion,
  type ProgressionTarget,
} from './progression';
import {
  changeSetType,
  EMPTY_SET_VALUES,
  groupSets,
  validateSet,
  type SetType,
  type SetValues,
  type WorkoutSet,
} from './sets';
import { DEFAULT_TRAINING_TYPE, getTrainingType, isKnownTrainingType } from './trainingTypes';
import type { TrainingRepositories, TrainingStore } from './trainingStore';
import {
  durationSeconds,
  normalizeOptionalText,
  WORKOUT_NOTES_MAX_LENGTH,
  WORKOUT_TITLE_MAX_LENGTH,
  type Workout,
  type WorkoutDetail,
  type WorkoutExercise,
  type WorkoutSummary,
} from './workout';
import type { LastPerformance } from './workoutRepository';

/** A new heaviest working set of an exercise, compared with all earlier workouts. */
export interface WorkoutRecord {
  workoutExerciseId: string;
  weightKg: number;
  previousKg: number;
}

/** Longest duration that can be entered for a finished workout (minutes). */
export const WORKOUT_DURATION_LIMITS_MIN = { min: 1, max: 24 * 60 } as const;

export interface TrainingOverview {
  last: WorkoutSummary | null;
  last7Days: number;
  last30Days: number;
}

/** The entry at `index`, or the last one if the list is shorter. */
function nearest<T>(items: readonly T[], index: number): T | undefined {
  return items[Math.min(index, items.length - 1)];
}

/** Values to pre-fill from a set of the previous performance (the new set is not completed). */
function prefill(source: WorkoutSet | undefined, targetReps: number | null = null): SetValues {
  return {
    ...EMPTY_SET_VALUES,
    weightKg: source?.weightKg ?? null,
    reps: source?.reps ?? targetReps,
    durationS: source?.durationS ?? null,
    distanceM: source?.distanceM ?? null,
  };
}

export class WorkoutService {
  constructor(
    private readonly store: TrainingStore,
    private readonly clock: Clock,
  ) {}

  private now() {
    return this.clock().toISOString();
  }

  // ── Reading ────────────────────────────────────────────────────────────────

  async getActive(profileId: string): Promise<WorkoutDetail | null> {
    const active = await this.store.repos.workouts.findActive(profileId);
    return active ? this.store.repos.workouts.loadDetail(profileId, active.id) : null;
  }

  async getDetail(profileId: string, workoutId: string): Promise<WorkoutDetail> {
    const detail = await this.store.repos.workouts.loadDetail(profileId, workoutId);
    if (!detail) throw new TrainingError('not-found');
    return detail;
  }

  getHistory(
    profileId: string,
    options: { limit: number; offset?: number; trainingType?: string },
  ): Promise<WorkoutSummary[]> {
    return this.store.repos.workouts.listCompleted(profileId, options);
  }

  /** Completed workouts between two local days (e.g. for the nutrition calculation). */
  completedBetween(profileId: string, fromLocalDate: string, toLocalDate: string) {
    return this.store.repos.workouts.completedBetween(profileId, fromLocalDate, toLocalDate);
  }

  /** Completed workouts and volume per day – for the progress main page. */
  dailyStatsBetween(profileId: string, fromLocalDate: string, toLocalDate: string) {
    return this.store.repos.workouts.dailyStatsBetween(profileId, fromLocalDate, toLocalDate);
  }

  /** Start and end of completed workouts – to recognise the same session imported elsewhere. */
  completedSpansBetween(profileId: string, fromLocalDate: string, toLocalDate: string) {
    return this.store.repos.workouts.completedSpansBetween(profileId, fromLocalDate, toLocalDate);
  }

  /** Trained minutes on a local day ; `null` if none. */
  async trainedMinutesOn(profileId: string, localDate: string): Promise<number | null> {
    const seconds = await this.store.repos.workouts.trainedSecondsOn(profileId, localDate);
    return seconds === null ? null : Math.round(seconds / 60);
  }

  /**
   * Read-only summary: the last completed workout and how many workouts
   * were completed in the last 7 and 30 days (including today).
   */
  async overview(profileId: string): Promise<TrainingOverview> {
    const today = this.clock();
    const since = (days: number) => toLocalDateKey(addDays(today, -(days - 1)));
    const [last] = await this.store.repos.workouts.listCompleted(profileId, { limit: 1 });
    return {
      last: last ?? null,
      last7Days: await this.store.repos.workouts.countCompletedFrom(profileId, since(7)),
      last30Days: await this.store.repos.workouts.countCompletedFrom(profileId, since(30)),
    };
  }

  countHistory(profileId: string, trainingType?: string): Promise<number> {
    return this.store.repos.workouts.countCompleted(profileId, trainingType);
  }

  /** Completed sets from the last workout with this exercise ("last time: 80 kg × 8"). */
  lastPerformance(
    profileId: string,
    exerciseId: string,
    excludeWorkoutId: string | null,
  ): Promise<LastPerformance | null> {
    return this.store.repos.workouts.lastPerformance(profileId, exerciseId, excludeWorkoutId);
  }

  /**
   * The weight increase suggestion for an exercise of a workout, or `null` (see
   * progression.ts). Needs the plan's rep target of the exercise in the plan day the workout
   * was started from; computed from the history, never stored.
   */
  async progression(
    profileId: string,
    workoutExerciseId: string,
    mode: ProgressionMode,
    unit: WeightUnit,
  ): Promise<ProgressionSuggestion | null> {
    if (mode === 'off') return null;
    const owner = await this.requireExercise(profileId, workoutExerciseId);
    const detail = await this.getDetail(profileId, owner.workoutId);
    const exercise = detail.exercises.find((e) => e.id === workoutExerciseId);
    if (!exercise?.exerciseId || exercise.exerciseType !== 'weighted') return null;
    const target = await this.planTarget(profileId, detail.planDayId, exercise.exerciseId);
    if (!target) return null;
    const sessions = await this.store.repos.workouts.recentPerformances(
      profileId,
      exercise.exerciseId,
      detail.id,
      PROGRESSION_MAX_SESSIONS,
    );
    return suggestProgression(
      sessions.map((session) => session.sets),
      target,
      mode,
      unit,
    );
  }

  /** New heaviest working sets of a finished workout (weighted exercises with earlier data). */
  async records(profileId: string, workoutId: string): Promise<WorkoutRecord[]> {
    const detail = await this.getDetail(profileId, workoutId);
    const records: WorkoutRecord[] = [];
    for (const exercise of detail.exercises) {
      if (!exercise.exerciseId || exercise.exerciseType !== 'weighted') continue;
      const loads = exercise.sets
        .filter((set) => set.completed && set.setType === 'working' && set.weightKg !== null)
        .map((set) => set.weightKg ?? 0);
      if (loads.length === 0) continue;
      const heaviest = Math.max(...loads);
      const previous = await this.store.repos.workouts.heaviestWorkingBefore(
        profileId,
        exercise.exerciseId,
        detail.startedAt,
        detail.id,
      );
      // No earlier value: the first time is no record.
      if (previous !== null && heaviest > previous) {
        records.push({ workoutExerciseId: exercise.id, weightKg: heaviest, previousKg: previous });
      }
    }
    return records;
  }

  /**
   * Best, latest and direction of a weighted exercise over all completed workouts (estimated
   * maximum, see `exerciseProgress`). Read-only; nothing is stored.
   */
  async exerciseProgress(profileId: string, exerciseId: string): Promise<ExerciseProgress> {
    return exerciseProgress(await this.store.repos.workouts.weightedHistory(profileId, exerciseId));
  }

  // ── Starting ───────────────────────────────────────────────────────────────

  /** Starts a workout without a plan. Only one workout can be in progress. */
  async startFree(profileId: string, trainingType = DEFAULT_TRAINING_TYPE): Promise<Workout> {
    this.assertStartable(trainingType);
    const workout = this.newWorkout(profileId, trainingType, null);
    await this.store.atomic(async (repos) => {
      await this.assertNoActive(repos, profileId);
      await repos.workouts.insertWorkout(workout);
    });
    return workout;
  }

  /**
   * Starts a workout from a plan day. Exercises and targets are copied into the workout, with
   * values pre-filled from the last performance. The plan itself is not referenced for display.
   */
  async startFromPlan(profileId: string, dayId: string): Promise<Workout> {
    const owner = await this.store.repos.plans.dayOwner(dayId);
    if (owner?.profileId !== profileId) throw new TrainingError('not-found');
    const plan = await this.store.repos.plans.findPlan(profileId, owner.planId);
    const day = plan?.days.find((d) => d.id === dayId);
    if (!plan || !day) throw new TrainingError('not-found');
    if (day.exercises.length === 0) throw new TrainingError('empty-plan-day');
    const trainingType = isKnownTrainingType(plan.trainingType)
      ? plan.trainingType
      : DEFAULT_TRAINING_TYPE;
    this.assertStartable(trainingType);

    const workout = this.newWorkout(profileId, trainingType, {
      planId: plan.id,
      planDayId: day.id,
      planName: plan.name,
      planDayName: day.name,
    });
    const now = workout.createdAt;
    await this.store.atomic(async (repos) => {
      await this.assertNoActive(repos, profileId);
      await repos.workouts.insertWorkout(workout);
      for (const [position, planned] of day.exercises.entries()) {
        const exercise = await repos.exercises.findById(planned.exerciseId);
        if (!exercise) continue;
        const workoutExercise = this.snapshot(workout.id, exercise, position);
        await repos.workouts.insertExercise(workoutExercise, now);
        const last = await repos.workouts.lastPerformance(profileId, exercise.id, workout.id);
        const previous = groupSets(last?.sets ?? []);
        let setPosition = 0;
        const insert = async (values: SetValues, setType: SetType, dropOf: string | null) => {
          const set = this.newSet(workoutExercise.id, setPosition, values, setType, dropOf);
          setPosition += 1;
          await repos.workouts.insertSet(set, now);
          return set;
        };
        // Warm-ups, working sets and the drops after the last working set, as planned.
        for (let index = 0; index < (planned.warmupSets ?? 0); index += 1) {
          await insert(prefill(nearest(previous.warmups, index)), 'warmup', null);
        }
        const workingCount = planned.targetSets ?? Math.max(1, previous.working.length);
        let lastWorking: WorkoutSet | null = null;
        for (let index = 0; index < workingCount; index += 1) {
          const source = nearest(previous.working, index)?.set;
          lastWorking = await insert(prefill(source, planned.targetReps), 'working', null);
        }
        const previousDrops = previous.working.at(-1)?.drops ?? [];
        for (let index = 0; index < (planned.dropSets ?? 0) && lastWorking; index += 1) {
          await insert(prefill(nearest(previousDrops, index)), 'drop', lastWorking.id);
        }
      }
    });
    return workout;
  }

  // ── Changing a workout ─────────────────────────────────────────────────────

  async addExercise(profileId: string, workoutId: string, exerciseId: string): Promise<string> {
    await this.requireWorkout(profileId, workoutId);
    const exercise = await this.store.repos.exercises.findById(exerciseId);
    if (!exercise || (exercise.profileId !== null && exercise.profileId !== profileId)) {
      throw new TrainingError('not-found');
    }
    if (!exercise.active) throw new TrainingError('exercise-inactive');
    const now = this.now();
    return this.store.atomic(async (repos) => {
      const position = await repos.workouts.nextExercisePosition(workoutId);
      const workoutExercise = this.snapshot(workoutId, exercise, position);
      await repos.workouts.insertExercise(workoutExercise, now);
      const last = await repos.workouts.lastPerformance(profileId, exercise.id, workoutId);
      const firstWorking = groupSets(last?.sets ?? []).working[0]?.set;
      await repos.workouts.insertSet(
        this.newSet(workoutExercise.id, 0, prefill(firstWorking), 'working', null),
        now,
      );
      await repos.workouts.touch(workoutId, now);
      return workoutExercise.id;
    });
  }

  /**
   * Replaces the exercise of this workout only – the plan is never changed. With the same
   * exercise type the sets stay; while the workout is in progress and nothing of the exercise
   * is completed yet, their values are pre-filled from the new exercise's last performance.
   * With another type the sets are created anew (same warm-up, working and drop structure,
   * pre-filled the same way): the old values would mean something else.
   */
  async replaceExercise(
    profileId: string,
    workoutExerciseId: string,
    exerciseId: string,
  ): Promise<void> {
    const owner = await this.requireExercise(profileId, workoutExerciseId);
    const detail = await this.getDetail(profileId, owner.workoutId);
    const current = detail.exercises.find((e) => e.id === workoutExerciseId);
    if (!current) throw new TrainingError('not-found');
    const exercise = await this.store.repos.exercises.findById(exerciseId);
    if (!exercise || (exercise.profileId !== null && exercise.profileId !== profileId)) {
      throw new TrainingError('not-found');
    }
    if (!exercise.active) throw new TrainingError('exercise-inactive');
    if (current.exerciseId === exercise.id) return;
    const now = this.now();
    const sameType = current.exerciseType === exercise.exerciseType;
    const untouched = detail.status === 'active' && !current.sets.some((set) => set.completed);
    await this.store.atomic(async (repos) => {
      await repos.workouts.updateExerciseSnapshot(
        { ...this.snapshot(detail.id, exercise, current.position), id: current.id },
        now,
      );
      if (sameType && !untouched) {
        await repos.workouts.touch(detail.id, now);
        return;
      }
      const last = await repos.workouts.lastPerformance(profileId, exercise.id, detail.id);
      const previous = groupSets(last?.sets ?? []);
      const { warmups, working } = groupSets(current.sets);
      if (sameType) {
        // Same structure, values of the new exercise (reps kept where it has no history).
        for (const [index, set] of warmups.entries()) {
          const source = nearest(previous.warmups, index);
          await repos.workouts.updateSet(set.id, this.refill(set, source), false, now);
        }
        for (const [index, group] of working.entries()) {
          const source = nearest(previous.working, index)?.set;
          await repos.workouts.updateSet(group.set.id, this.refill(group.set, source), false, now);
          const drops = previous.working.at(-1)?.drops ?? [];
          for (const [d, drop] of group.drops.entries()) {
            await repos.workouts.updateSet(
              drop.id,
              this.refill(drop, nearest(drops, d)),
              false,
              now,
            );
          }
        }
      } else {
        await repos.workouts.deleteSetsOf(current.id);
        let position = 0;
        const insert = async (values: SetValues, setType: SetType, dropOf: string | null) => {
          const set = this.newSet(current.id, position, values, setType, dropOf);
          position += 1;
          await repos.workouts.insertSet(set, now);
          return set;
        };
        for (const [index] of warmups.entries()) {
          await insert(prefill(nearest(previous.warmups, index)), 'warmup', null);
        }
        const count = Math.max(1, working.length);
        for (let index = 0; index < count; index += 1) {
          const set = await insert(prefill(nearest(previous.working, index)?.set), 'working', null);
          const drops = previous.working.at(-1)?.drops ?? [];
          for (const [d] of (working[index]?.drops ?? []).entries()) {
            await insert(prefill(nearest(drops, d)), 'drop', set.id);
          }
        }
      }
      await repos.workouts.touch(detail.id, now);
    });
  }

  async removeExercise(profileId: string, workoutExerciseId: string): Promise<void> {
    const owner = await this.requireExercise(profileId, workoutExerciseId);
    const detail = await this.getDetail(profileId, owner.workoutId);
    const remaining = detail.exercises.filter((e) => e.id !== workoutExerciseId).map((e) => e.id);
    const now = this.now();
    await this.store.atomic(async (repos) => {
      await repos.workouts.deleteExercise(workoutExerciseId);
      await repos.workouts.setExercisePositions(remaining, now);
      await repos.workouts.touch(owner.workoutId, now);
    });
  }

  async moveExercise(profileId: string, workoutExerciseId: string, delta: -1 | 1): Promise<void> {
    const owner = await this.requireExercise(profileId, workoutExerciseId);
    const detail = await this.getDetail(profileId, owner.workoutId);
    const index = detail.exercises.findIndex((e) => e.id === workoutExerciseId);
    const ordered = moveItem(detail.exercises, index, delta).map((e) => e.id);
    const now = this.now();
    await this.store.atomic(async (repos) => {
      await repos.workouts.setExercisePositions(ordered, now);
      await repos.workouts.touch(owner.workoutId, now);
    });
  }

  /**
   * Adds a working set (at the end, pre-filled from the previous working set) or a warm-up set
   * (after the existing warm-ups, before the first working set).
   */
  async addSet(
    profileId: string,
    workoutExerciseId: string,
    setType: 'working' | 'warmup' = 'working',
  ): Promise<string> {
    const owner = await this.requireExercise(profileId, workoutExerciseId);
    const sets = await this.exerciseSets(profileId, owner.workoutId, workoutExerciseId);
    const { warmups, working } = groupSets(sets);
    const previous = setType === 'warmup' ? warmups.at(-1) : working.at(-1)?.set;
    const values: SetValues = previous ? { ...prefill(previous), rpe: null } : EMPTY_SET_VALUES;
    const now = this.now();
    return this.store.atomic(async (repos) => {
      let position: number;
      if (setType === 'warmup') {
        position = previous
          ? previous.position + 1
          : (working[0]?.set.position ?? (await repos.workouts.nextSetPosition(workoutExerciseId)));
        await repos.workouts.shiftSetPositions(workoutExerciseId, position);
      } else {
        position = await repos.workouts.nextSetPosition(workoutExerciseId);
      }
      const set = this.newSet(workoutExerciseId, position, values, setType, null);
      await repos.workouts.insertSet(set, now);
      await repos.workouts.touch(owner.workoutId, now);
      return set.id;
    });
  }

  /**
   * Adds a drop to a working set: placed after its existing drops, values left empty (a drop
   * uses a lower load than the set before).
   */
  async addDrop(profileId: string, workingSetId: string): Promise<string> {
    const owner = await this.store.repos.workouts.setOwner(workingSetId);
    if (owner?.profileId !== profileId) throw new TrainingError('not-found');
    const sets = await this.exerciseSets(profileId, owner.workoutId, owner.workoutExerciseId);
    const group = groupSets(sets).working.find((g) => g.set.id === workingSetId);
    if (!group) throw new TrainingError('invalid-value');
    const position = (group.drops.at(-1) ?? group.set).position + 1;
    const now = this.now();
    return this.store.atomic(async (repos) => {
      await repos.workouts.shiftSetPositions(owner.workoutExerciseId, position);
      const set = this.newSet(
        owner.workoutExerciseId,
        position,
        EMPTY_SET_VALUES,
        'drop',
        workingSetId,
      );
      await repos.workouts.insertSet(set, now);
      await repos.workouts.touch(owner.workoutId, now);
      return set.id;
    });
  }

  /**
   * Saves a set. Values must always be within plausible limits; completing a set additionally
   * requires the fields of its exercise type (e.g. load and reps for a weighted exercise).
   */
  async updateSet(
    profileId: string,
    setId: string,
    values: SetValues,
    completed: boolean,
  ): Promise<void> {
    const owner = await this.store.repos.workouts.setOwner(setId);
    if (owner?.profileId !== profileId) throw new TrainingError('not-found');
    const type = isOneOf(EXERCISE_TYPES, owner.exerciseType) ? owner.exerciseType : 'weighted';
    const errors = validateSet(values, type).filter(
      (error) => completed || error.problem !== 'required',
    );
    if (errors.length > 0) throw new TrainingError('invalid-set', errors);
    const now = this.now();
    await this.store.atomic(async (repos) => {
      await repos.workouts.updateSet(setId, values, completed, now);
      await repos.workouts.touch(owner.workoutId, now);
    });
  }

  /**
   * Changes a set to a warm-up, working set or drop (see `allowedSetTypes`); its values stay.
   * Positions are renumbered so the usual order is kept.
   */
  async changeSetType(profileId: string, setId: string, setType: SetType): Promise<void> {
    const owner = await this.store.repos.workouts.setOwner(setId);
    if (owner?.profileId !== profileId) throw new TrainingError('not-found');
    const sets = await this.exerciseSets(profileId, owner.workoutId, owner.workoutExerciseId);
    const structure = changeSetType(sets, setId, setType);
    if (!structure) throw new TrainingError('invalid-value');
    const now = this.now();
    await this.store.atomic(async (repos) => {
      for (const set of structure) await repos.workouts.updateSetStructure(set.id, set, now);
      await repos.workouts.touch(owner.workoutId, now);
    });
  }

  async deleteSet(profileId: string, setId: string): Promise<void> {
    const owner = await this.store.repos.workouts.setOwner(setId);
    if (owner?.profileId !== profileId) throw new TrainingError('not-found');
    const now = this.now();
    await this.store.atomic(async (repos) => {
      await repos.workouts.deleteSet(setId);
      await repos.workouts.touch(owner.workoutId, now);
    });
  }

  async updateDetails(
    profileId: string,
    workoutId: string,
    title: string,
    notes: string,
  ): Promise<void> {
    await this.requireWorkout(profileId, workoutId);
    await this.store.repos.workouts.updateMeta(
      workoutId,
      normalizeOptionalText(title, WORKOUT_TITLE_MAX_LENGTH),
      normalizeOptionalText(notes, WORKOUT_NOTES_MAX_LENGTH),
      this.now(),
    );
  }

  /** Corrects the duration of a finished workout; the start stays, the end follows. */
  async updateDuration(profileId: string, workoutId: string, minutes: number): Promise<void> {
    const workout = await this.requireWorkout(profileId, workoutId);
    if (workout.status !== 'completed') throw new TrainingError('workout-not-active');
    const { min, max } = WORKOUT_DURATION_LIMITS_MIN;
    if (!Number.isInteger(minutes) || minutes < min || minutes > max) {
      throw new TrainingError('invalid-value');
    }
    const durationS = minutes * 60;
    const endedAt = new Date(Date.parse(workout.startedAt) + durationS * 1000).toISOString();
    await this.store.repos.workouts.updateTiming(workoutId, endedAt, durationS, this.now());
  }

  // ── Ending ─────────────────────────────────────────────────────────────────

  /** Finishes the active workout: drops untouched placeholder sets and stores the duration. */
  async finish(profileId: string, workoutId: string): Promise<Workout> {
    const workout = await this.requireWorkout(profileId, workoutId);
    if (workout.status !== 'active') throw new TrainingError('workout-not-active');
    const endedAt = this.now();
    const durationS = durationSeconds(workout.startedAt, endedAt);
    await this.store.atomic(async (repos) => {
      await repos.workouts.deleteEmptySets(workoutId);
      await repos.workouts.finish(workoutId, endedAt, durationS, endedAt);
    });
    return { ...workout, status: 'completed', endedAt, durationS, updatedAt: endedAt };
  }

  /** Discards the workout in progress (nothing is kept). */
  async discard(profileId: string, workoutId: string): Promise<void> {
    const workout = await this.requireWorkout(profileId, workoutId);
    if (workout.status !== 'active') throw new TrainingError('workout-not-active');
    await this.store.repos.workouts.deleteWorkout(profileId, workoutId);
  }

  /** Deletes a completed workout with its exercises and sets. */
  async delete(profileId: string, workoutId: string): Promise<void> {
    if (!(await this.store.repos.workouts.deleteWorkout(profileId, workoutId))) {
      throw new TrainingError('not-found');
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private newWorkout(
    profileId: string,
    trainingType: string,
    plan: Pick<Workout, 'planId' | 'planDayId' | 'planName' | 'planDayName'> | null,
  ): Workout {
    const start = this.clock();
    const now = start.toISOString();
    return {
      id: createId(),
      profileId,
      trainingType,
      status: 'active',
      title: null,
      notes: null,
      startedAt: now,
      endedAt: null,
      durationS: null,
      localDate: toLocalDateKey(start),
      planId: plan?.planId ?? null,
      planDayId: plan?.planDayId ?? null,
      planName: plan?.planName ?? null,
      planDayName: plan?.planDayName ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  /** The rep target of an exercise in the plan day a workout came from (current plan). */
  private async planTarget(
    profileId: string,
    planDayId: string | null,
    exerciseId: string,
  ): Promise<ProgressionTarget | null> {
    if (!planDayId) return null;
    const owner = await this.store.repos.plans.dayOwner(planDayId);
    if (owner?.profileId !== profileId) return null;
    const plan = await this.store.repos.plans.findPlan(profileId, owner.planId);
    const planned = plan?.days
      .find((day) => day.id === planDayId)
      ?.exercises.find((e) => e.exerciseId === exerciseId);
    if (planned?.targetReps == null) return null;
    return { reps: planned.targetReps, sets: planned.targetSets };
  }

  /** A set's values from the new exercise's history; without history only the reps stay. */
  private refill(set: WorkoutSet, source: WorkoutSet | undefined): SetValues {
    return source ? prefill(source) : { ...EMPTY_SET_VALUES, reps: set.reps };
  }

  private snapshot(workoutId: string, exercise: Exercise, position: number): WorkoutExercise {
    return {
      id: createId(),
      workoutId,
      exerciseId: exercise.id,
      position,
      nameDe: exercise.nameDe,
      nameEn: exercise.nameEn,
      exerciseType: exercise.exerciseType,
    };
  }

  private newSet(
    workoutExerciseId: string,
    position: number,
    values: SetValues,
    setType: SetType,
    dropOf: string | null,
  ): WorkoutSet {
    return {
      id: createId(),
      workoutExerciseId,
      position,
      ...values,
      setType,
      dropOf,
      completed: false,
    };
  }

  private async exerciseSets(profileId: string, workoutId: string, workoutExerciseId: string) {
    const detail = await this.getDetail(profileId, workoutId);
    return detail.exercises.find((e) => e.id === workoutExerciseId)?.sets ?? [];
  }

  private assertStartable(trainingType: string) {
    if (!isKnownTrainingType(trainingType)) throw new TrainingError('unknown-training-type');
    if (!getTrainingType(trainingType).available) {
      throw new TrainingError('unavailable-training-type');
    }
  }

  private async assertNoActive(repos: TrainingRepositories, profileId: string) {
    if (await repos.workouts.findActive(profileId)) {
      throw new TrainingError('active-workout-exists');
    }
  }

  private async requireWorkout(profileId: string, workoutId: string): Promise<Workout> {
    const workout = await this.store.repos.workouts.findWorkout(profileId, workoutId);
    if (!workout) throw new TrainingError('not-found');
    return workout;
  }

  private async requireExercise(profileId: string, workoutExerciseId: string) {
    const owner = await this.store.repos.workouts.exerciseOwner(workoutExerciseId);
    if (owner?.profileId !== profileId) throw new TrainingError('not-found');
    return owner;
  }
}
