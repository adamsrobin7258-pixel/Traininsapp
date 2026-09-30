import type { SqlExecutor, SqlValue } from '@/core/database';
import { EXERCISE_TYPES, isOneOf } from './exercise';
import { SET_TYPES, type SetValues, type WorkoutSet } from './sets';
import type {
  Workout,
  WorkoutDetail,
  WorkoutExercise,
  WorkoutStatus,
  WorkoutSummary,
} from './workout';

interface WorkoutRow {
  id: string;
  profile_id: string;
  training_type: string;
  status: WorkoutStatus;
  title: string | null;
  notes: string | null;
  started_at: string;
  ended_at: string | null;
  duration_s: number | null;
  local_date: string;
  plan_id: string | null;
  plan_day_id: string | null;
  plan_name: string | null;
  plan_day_name: string | null;
  created_at: string;
  updated_at: string;
}

interface ExerciseRow {
  id: string;
  workout_id: string;
  exercise_id: string | null;
  position: number;
  name_de: string;
  name_en: string;
  exercise_type: string;
}

interface SetRow {
  id: string;
  workout_exercise_id: string;
  position: number;
  weight_kg: number | null;
  reps: number | null;
  duration_s: number | null;
  distance_m: number | null;
  rpe: number | null;
  completed: number;
  set_type: string;
  drop_of: string | null;
}

const toWorkout = (row: WorkoutRow): Workout => ({
  id: row.id,
  profileId: row.profile_id,
  trainingType: row.training_type,
  status: row.status,
  title: row.title,
  notes: row.notes,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  durationS: row.duration_s,
  localDate: row.local_date,
  planId: row.plan_id,
  planDayId: row.plan_day_id,
  planName: row.plan_name,
  planDayName: row.plan_day_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toExercise = (row: ExerciseRow): WorkoutExercise => ({
  id: row.id,
  workoutId: row.workout_id,
  exerciseId: row.exercise_id,
  position: row.position,
  nameDe: row.name_de,
  nameEn: row.name_en,
  exerciseType: isOneOf(EXERCISE_TYPES, row.exercise_type) ? row.exercise_type : 'weighted',
});

const toSet = (row: SetRow): WorkoutSet => ({
  id: row.id,
  workoutExerciseId: row.workout_exercise_id,
  position: row.position,
  weightKg: row.weight_kg,
  reps: row.reps,
  durationS: row.duration_s,
  distanceM: row.distance_m,
  rpe: row.rpe,
  // Unknown values (a newer app version) read as working sets, like rows from before 0.2.1.
  setType: isOneOf(SET_TYPES, row.set_type) ? row.set_type : 'working',
  dropOf: row.drop_of,
  completed: row.completed === 1,
});

const setParams = (values: SetValues): SqlValue[] => [
  values.weightKg,
  values.reps,
  values.durationS,
  values.distanceM,
  values.rpe,
];

export interface LastPerformance {
  workoutId: string;
  localDate: string;
  sets: WorkoutSet[];
}

/** SQL for workouts, their exercises and sets. Queries are scoped to one profile. */
export class WorkoutRepository {
  constructor(private readonly db: SqlExecutor) {}

  async findActive(profileId: string): Promise<Workout | null> {
    const rows = await this.db.query<WorkoutRow>(
      "SELECT * FROM workouts WHERE profile_id = ? AND status = 'active' LIMIT 1",
      [profileId],
    );
    return rows[0] ? toWorkout(rows[0]) : null;
  }

  async findWorkout(profileId: string, id: string): Promise<Workout | null> {
    const rows = await this.db.query<WorkoutRow>(
      'SELECT * FROM workouts WHERE id = ? AND profile_id = ?',
      [id, profileId],
    );
    return rows[0] ? toWorkout(rows[0]) : null;
  }

  async loadDetail(profileId: string, id: string): Promise<WorkoutDetail | null> {
    const workout = await this.findWorkout(profileId, id);
    if (!workout) return null;
    const exercises = await this.db.query<ExerciseRow>(
      'SELECT * FROM workout_exercises WHERE workout_id = ? ORDER BY position',
      [id],
    );
    const sets = await this.db.query<SetRow>(
      `SELECT s.* FROM workout_sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
       WHERE we.workout_id = ? ORDER BY s.position`,
      [id],
    );
    return {
      ...workout,
      exercises: exercises.map((row) => ({
        ...toExercise(row),
        sets: sets.filter((set) => set.workout_exercise_id === row.id).map(toSet),
      })),
    };
  }

  /** Completed workouts, newest first; optionally one training type. No sets are loaded. */
  async listCompleted(
    profileId: string,
    { limit, offset = 0, trainingType }: { limit: number; offset?: number; trainingType?: string },
  ): Promise<WorkoutSummary[]> {
    const rows = await this.db.query<
      WorkoutRow & { exercise_count: number; completed_set_count: number }
    >(
      `SELECT w.*,
         (SELECT COUNT(*) FROM workout_exercises we WHERE we.workout_id = w.id) AS exercise_count,
         (SELECT COUNT(*) FROM workout_sets s JOIN workout_exercises we
            ON we.id = s.workout_exercise_id
          WHERE we.workout_id = w.id AND s.completed = 1 AND s.set_type = 'working')
           AS completed_set_count
       FROM workouts w
       WHERE w.profile_id = ? AND w.status = 'completed' AND (? IS NULL OR w.training_type = ?)
       ORDER BY w.started_at DESC LIMIT ? OFFSET ?`,
      [profileId, trainingType ?? null, trainingType ?? null, limit, offset],
    );
    return rows.map((row) => ({
      id: row.id,
      trainingType: row.training_type,
      title: row.title,
      planDayName: row.plan_day_name,
      startedAt: row.started_at,
      localDate: row.local_date,
      durationS: row.duration_s,
      exerciseCount: row.exercise_count,
      completedSetCount: row.completed_set_count,
    }));
  }

  async countCompleted(profileId: string, trainingType?: string): Promise<number> {
    const rows = await this.db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM workouts
       WHERE profile_id = ? AND status = 'completed' AND (? IS NULL OR training_type = ?)`,
      [profileId, trainingType ?? null, trainingType ?? null],
    );
    return rows[0]?.n ?? 0;
  }

  /** Completed workouts on or after a local day (`YYYY-MM-DD`). */
  async countCompletedFrom(profileId: string, fromLocalDate: string): Promise<number> {
    const rows = await this.db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM workouts
       WHERE profile_id = ? AND status = 'completed' AND local_date >= ?`,
      [profileId, fromLocalDate],
    );
    return rows[0]?.n ?? 0;
  }

  /** Sum of completed workout durations on a local day, `null` when nothing was trained. */
  async trainedSecondsOn(profileId: string, localDate: string): Promise<number | null> {
    const rows = await this.db.query<{ total: number | null }>(
      `SELECT SUM(duration_s) AS total FROM workouts
       WHERE profile_id = ? AND status = 'completed' AND local_date = ?`,
      [profileId, localDate],
    );
    return rows[0]?.total ?? null;
  }

  async insertWorkout(workout: Workout): Promise<void> {
    await this.db.run(
      `INSERT INTO workouts (id, profile_id, training_type, status, title, notes, started_at,
         ended_at, duration_s, local_date, plan_id, plan_day_id, plan_name, plan_day_name,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workout.id,
        workout.profileId,
        workout.trainingType,
        workout.status,
        workout.title,
        workout.notes,
        workout.startedAt,
        workout.endedAt,
        workout.durationS,
        workout.localDate,
        workout.planId,
        workout.planDayId,
        workout.planName,
        workout.planDayName,
        workout.createdAt,
        workout.updatedAt,
      ],
    );
  }

  async updateMeta(id: string, title: string | null, notes: string | null, now: string) {
    await this.db.run('UPDATE workouts SET title = ?, notes = ?, updated_at = ? WHERE id = ?', [
      title,
      notes,
      now,
      id,
    ]);
  }

  async finish(id: string, endedAt: string, durationS: number, now: string): Promise<void> {
    await this.db.run(
      `UPDATE workouts SET status = 'completed', ended_at = ?, duration_s = ?, updated_at = ?
       WHERE id = ? AND status = 'active'`,
      [endedAt, durationS, now, id],
    );
  }

  async touch(id: string, now: string): Promise<void> {
    await this.db.run('UPDATE workouts SET updated_at = ? WHERE id = ?', [now, id]);
  }

  async deleteWorkout(profileId: string, id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM workouts WHERE id = ? AND profile_id = ?', [
      id,
      profileId,
    ]);
    return result.changes === 1;
  }

  async nextExercisePosition(workoutId: string): Promise<number> {
    const rows = await this.db.query<{ next: number }>(
      'SELECT COALESCE(MAX(position) + 1, 0) AS next FROM workout_exercises WHERE workout_id = ?',
      [workoutId],
    );
    return rows[0]?.next ?? 0;
  }

  async insertExercise(exercise: WorkoutExercise, now: string): Promise<void> {
    await this.db.run(
      `INSERT INTO workout_exercises (id, workout_id, exercise_id, position, name_de, name_en,
         exercise_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exercise.id,
        exercise.workoutId,
        exercise.exerciseId,
        exercise.position,
        exercise.nameDe,
        exercise.nameEn,
        exercise.exerciseType,
        now,
        now,
      ],
    );
  }

  async deleteExercise(id: string): Promise<void> {
    await this.db.run('DELETE FROM workout_exercises WHERE id = ?', [id]);
  }

  async setExercisePositions(orderedIds: readonly string[], now: string): Promise<void> {
    for (const [position, id] of orderedIds.entries()) {
      await this.db.run('UPDATE workout_exercises SET position = ?, updated_at = ? WHERE id = ?', [
        position,
        now,
        id,
      ]);
    }
  }

  async nextSetPosition(workoutExerciseId: string): Promise<number> {
    const rows = await this.db.query<{ next: number }>(
      'SELECT COALESCE(MAX(position) + 1, 0) AS next FROM workout_sets WHERE workout_exercise_id = ?',
      [workoutExerciseId],
    );
    return rows[0]?.next ?? 0;
  }

  async insertSet(set: WorkoutSet, now: string): Promise<void> {
    await this.db.run(
      `INSERT INTO workout_sets (id, workout_exercise_id, position, weight_kg, reps, duration_s,
         distance_m, rpe, completed, set_type, drop_of, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        set.id,
        set.workoutExerciseId,
        set.position,
        ...setParams(set),
        set.completed ? 1 : 0,
        set.setType,
        set.dropOf,
        now,
        now,
      ],
    );
  }

  /** Makes room for a set inserted at `position` (later sets move down by one). */
  async shiftSetPositions(workoutExerciseId: string, fromPosition: number): Promise<void> {
    await this.db.run(
      `UPDATE workout_sets SET position = position + 1
       WHERE workout_exercise_id = ? AND position >= ?`,
      [workoutExerciseId, fromPosition],
    );
  }

  async updateSet(id: string, values: SetValues, completed: boolean, now: string): Promise<void> {
    await this.db.run(
      `UPDATE workout_sets SET weight_kg = ?, reps = ?, duration_s = ?, distance_m = ?, rpe = ?,
         completed = ?, updated_at = ? WHERE id = ?`,
      [...setParams(values), completed ? 1 : 0, now, id],
    );
  }

  async deleteSet(id: string): Promise<void> {
    await this.db.run('DELETE FROM workout_sets WHERE id = ?', [id]);
  }

  /**
   * Removes placeholder sets without any value (e.g. unused planned sets) from a workout. Empty
   * drops go first; a working set is kept while it still has a drop with values.
   */
  async deleteEmptySets(workoutId: string): Promise<void> {
    const empty = `workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)
       AND weight_kg IS NULL AND reps IS NULL AND duration_s IS NULL AND distance_m IS NULL
       AND rpe IS NULL`;
    await this.db.run(`DELETE FROM workout_sets WHERE set_type = 'drop' AND ${empty}`, [workoutId]);
    await this.db.run(
      `DELETE FROM workout_sets WHERE ${empty}
       AND NOT EXISTS (SELECT 1 FROM workout_sets d WHERE d.drop_of = workout_sets.id)`,
      [workoutId],
    );
  }

  async exerciseOwner(
    workoutExerciseId: string,
  ): Promise<{ workoutId: string; profileId: string } | null> {
    const rows = await this.db.query<{ workout_id: string; profile_id: string }>(
      `SELECT we.workout_id, w.profile_id FROM workout_exercises we
       JOIN workouts w ON w.id = we.workout_id WHERE we.id = ?`,
      [workoutExerciseId],
    );
    const row = rows[0];
    return row ? { workoutId: row.workout_id, profileId: row.profile_id } : null;
  }

  async setOwner(setId: string): Promise<{
    workoutExerciseId: string;
    workoutId: string;
    profileId: string;
    exerciseType: string;
  } | null> {
    const rows = await this.db.query<{
      workout_exercise_id: string;
      workout_id: string;
      profile_id: string;
      exercise_type: string;
    }>(
      `SELECT s.workout_exercise_id, we.workout_id, w.profile_id, we.exercise_type
       FROM workout_sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
       JOIN workouts w ON w.id = we.workout_id WHERE s.id = ?`,
      [setId],
    );
    const row = rows[0];
    return row
      ? {
          workoutExerciseId: row.workout_exercise_id,
          workoutId: row.workout_id,
          profileId: row.profile_id,
          exerciseType: row.exercise_type,
        }
      : null;
  }

  /** Completed sets of the most recent completed workout that contained the exercise. */
  async lastPerformance(
    profileId: string,
    exerciseId: string,
    excludeWorkoutId: string | null,
  ): Promise<LastPerformance | null> {
    const workouts = await this.db.query<{ id: string; local_date: string; we_id: string }>(
      `SELECT w.id, w.local_date, we.id AS we_id FROM workout_exercises we
       JOIN workouts w ON w.id = we.workout_id
       WHERE we.exercise_id = ? AND w.profile_id = ? AND w.status = 'completed'
         AND (? IS NULL OR w.id <> ?)
         AND EXISTS (SELECT 1 FROM workout_sets s WHERE s.workout_exercise_id = we.id AND s.completed = 1)
       ORDER BY w.started_at DESC, we.position LIMIT 1`,
      [exerciseId, profileId, excludeWorkoutId, excludeWorkoutId],
    );
    const hit = workouts[0];
    if (!hit) return null;
    const sets = await this.db.query<SetRow>(
      `SELECT * FROM workout_sets WHERE workout_exercise_id = ? AND completed = 1
       ORDER BY position`,
      [hit.we_id],
    );
    return { workoutId: hit.id, localDate: hit.local_date, sets: sets.map(toSet) };
  }
}
