import type { ExerciseType } from './exercise';
import type { WorkoutSet } from './sets';

/**
 * A workout records what was actually done. It is a historical snapshot: exercise names,
 * exercise types and plan names are copied at the time of training, so later changes to
 * plans or exercises never alter history.
 */
export type WorkoutStatus = 'active' | 'completed';

export interface Workout {
  id: string;
  profileId: string;
  /** Id from the training type registry (see trainingTypes.ts). */
  trainingType: string;
  status: WorkoutStatus;
  title: string | null;
  notes: string | null;
  startedAt: string;
  endedAt: string | null;
  /** Seconds; set when the workout is finished. */
  durationS: number | null;
  /** Local calendar day of the start (YYYY-MM-DD), for history and day views. */
  localDate: string;
  /** Source plan; `null` for free workouts or when the plan was deleted later. */
  planId: string | null;
  planDayId: string | null;
  /** Snapshots, kept even after the plan is renamed or deleted. */
  planName: string | null;
  planDayName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutExercise {
  id: string;
  workoutId: string;
  /** Catalog reference for history lookups; `null` if the exercise no longer exists. */
  exerciseId: string | null;
  position: number;
  /** Snapshot of the name at training time (both languages for system exercises). */
  nameDe: string;
  nameEn: string;
  /** Snapshot of the exercise type, so old sets keep their meaning. */
  exerciseType: ExerciseType;
}

export interface WorkoutExerciseWithSets extends WorkoutExercise {
  sets: WorkoutSet[];
}

export interface WorkoutDetail extends Workout {
  exercises: WorkoutExerciseWithSets[];
}

/** Compact row for history lists; loaded without sets. */
export interface WorkoutSummary {
  id: string;
  trainingType: string;
  title: string | null;
  planDayName: string | null;
  startedAt: string;
  localDate: string;
  durationS: number | null;
  exerciseCount: number;
  completedSetCount: number;
}

export const WORKOUT_TITLE_MAX_LENGTH = 60;
export const WORKOUT_NOTES_MAX_LENGTH = 2000;

export function durationSeconds(startedAt: string, endedAt: string): number {
  const ms = Date.parse(endedAt) - Date.parse(startedAt);
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : 0;
}

/** Title shown in lists: user title, else plan day name, else `null` (UI uses a default). */
export function workoutDisplayTitle(
  workout: Pick<Workout, 'title' | 'planDayName'> | Pick<WorkoutSummary, 'title' | 'planDayName'>,
): string | null {
  return workout.title ?? workout.planDayName;
}

/** Optional free text: trimmed, empty → null, limited length. */
export function normalizeOptionalText(input: string, maxLength: number): string | null {
  const text = input.trim();
  if (text === '') return null;
  return Array.from(text).slice(0, maxLength).join('');
}
