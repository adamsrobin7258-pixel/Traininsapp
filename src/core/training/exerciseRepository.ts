import type { SqlExecutor } from '@/core/database';
import {
  EQUIPMENT,
  EXERCISE_TYPES,
  isOneOf,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  type Exercise,
  type MuscleGroup,
} from './exercise';
import type { CatalogExercise } from './exerciseCatalog';

interface ExerciseRow {
  id: string;
  source: 'system' | 'user';
  profile_id: string | null;
  name_de: string;
  name_en: string;
  exercise_type: string;
  equipment: string;
  movement_pattern: string;
  instructions_de: string | null;
  instructions_en: string | null;
  active: number;
  muscles: string | null;
}

// Muscles keep their catalog order (insertion order), most important first.
const SELECT = `
  SELECT e.*, (
    SELECT group_concat(pair) FROM (
      SELECT m.role || ':' || m.muscle AS pair FROM exercise_muscles m
      WHERE m.exercise_id = e.id ORDER BY m.rowid
    )
  ) AS muscles
  FROM exercises e`;

function toExercise(row: ExerciseRow): Exercise {
  const primary: MuscleGroup[] = [];
  const secondary: MuscleGroup[] = [];
  for (const pair of row.muscles?.split(',') ?? []) {
    const [role, muscle] = pair.split(':');
    if (!isOneOf(MUSCLE_GROUPS, muscle)) continue;
    (role === 'primary' ? primary : secondary).push(muscle);
  }
  return {
    id: row.id,
    source: row.source,
    profileId: row.profile_id,
    nameDe: row.name_de,
    nameEn: row.name_en,
    // Unknown values (e.g. from a newer catalog) degrade gracefully instead of crashing.
    exerciseType: isOneOf(EXERCISE_TYPES, row.exercise_type) ? row.exercise_type : 'weighted',
    equipment: isOneOf(EQUIPMENT, row.equipment) ? row.equipment : 'other',
    movementPattern: isOneOf(MOVEMENT_PATTERNS, row.movement_pattern)
      ? row.movement_pattern
      : 'other',
    primaryMuscles: primary,
    secondaryMuscles: secondary,
    instructionsDe: row.instructions_de,
    instructionsEn: row.instructions_en,
    active: row.active === 1,
  };
}

export class ExerciseRepository {
  constructor(private readonly db: SqlExecutor) {}

  /** System exercises plus the profile's own ones. */
  async listForProfile(profileId: string, { includeInactive = false } = {}): Promise<Exercise[]> {
    const rows = await this.db.query<ExerciseRow>(
      `${SELECT} WHERE (e.profile_id IS NULL OR e.profile_id = ?) AND (? = 1 OR e.active = 1)`,
      [profileId, includeInactive ? 1 : 0],
    );
    return rows.map(toExercise);
  }

  async findById(id: string): Promise<Exercise | null> {
    const rows = await this.db.query<ExerciseRow>(`${SELECT} WHERE e.id = ?`, [id]);
    return rows[0] ? toExercise(rows[0]) : null;
  }

  async insertUserExercise(exercise: Exercise, now: string): Promise<void> {
    await this.db.run(
      `INSERT INTO exercises (id, source, profile_id, name_de, name_en, exercise_type, equipment,
         movement_pattern, active, created_at, updated_at)
       VALUES (?, 'user', ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        exercise.id,
        exercise.profileId,
        exercise.nameDe,
        exercise.nameEn,
        exercise.exerciseType,
        exercise.equipment,
        exercise.movementPattern,
        now,
        now,
      ],
    );
    await this.replaceMuscles(exercise.id, exercise.primaryMuscles, exercise.secondaryMuscles);
  }

  async updateUserExercise(profileId: string, exercise: Exercise, now: string): Promise<boolean> {
    const result = await this.db.run(
      `UPDATE exercises SET name_de = ?, name_en = ?, exercise_type = ?, equipment = ?,
         movement_pattern = ?, updated_at = ?
       WHERE id = ? AND source = 'user' AND profile_id = ?`,
      [
        exercise.nameDe,
        exercise.nameEn,
        exercise.exerciseType,
        exercise.equipment,
        exercise.movementPattern,
        now,
        exercise.id,
        profileId,
      ],
    );
    if (result.changes !== 1) return false;
    await this.replaceMuscles(exercise.id, exercise.primaryMuscles, exercise.secondaryMuscles);
    return true;
  }

  /** User exercises are never deleted, only (de)activated, so history stays intact. */
  async setUserExerciseActive(profileId: string, id: string, active: boolean, now: string) {
    const result = await this.db.run(
      `UPDATE exercises SET active = ?, updated_at = ?
       WHERE id = ? AND source = 'user' AND profile_id = ?`,
      [active ? 1 : 0, now, id, profileId],
    );
    return result.changes === 1;
  }

  /** Upserts the bundled catalog; system exercises missing from it are deactivated. */
  async syncCatalog(catalog: readonly CatalogExercise[], now: string): Promise<void> {
    for (const item of catalog) {
      await this.db.run(
        `INSERT INTO exercises (id, source, profile_id, name_de, name_en, exercise_type, equipment,
           movement_pattern, active, created_at, updated_at)
         VALUES (?, 'system', NULL, ?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name_de = excluded.name_de, name_en = excluded.name_en,
           exercise_type = excluded.exercise_type, equipment = excluded.equipment,
           movement_pattern = excluded.movement_pattern, active = 1, updated_at = excluded.updated_at`,
        [
          item.id,
          item.nameDe,
          item.nameEn,
          item.exerciseType,
          item.equipment,
          item.movementPattern,
          now,
          now,
        ],
      );
      await this.replaceMuscles(item.id, item.primary, item.secondary ?? []);
    }
    const ids = catalog.map((item) => item.id);
    await this.db.run(
      `UPDATE exercises SET active = 0, updated_at = ?
       WHERE source = 'system' AND active = 1 AND id NOT IN (${ids.map(() => '?').join(', ') || "''"})`,
      [now, ...ids],
    );
  }

  private async replaceMuscles(id: string, primary: MuscleGroup[], secondary: MuscleGroup[]) {
    await this.db.run('DELETE FROM exercise_muscles WHERE exercise_id = ?', [id]);
    const rows = [
      ...primary.map((muscle) => [muscle, 'primary'] as const),
      ...secondary
        .filter((muscle) => !primary.includes(muscle))
        .map((muscle) => [muscle, 'secondary'] as const),
    ];
    for (const [muscle, role] of rows) {
      await this.db.run(
        'INSERT INTO exercise_muscles (exercise_id, muscle, role) VALUES (?, ?, ?)',
        [id, muscle, role],
      );
    }
  }
}
