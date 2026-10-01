import type { Clock } from '@/shared/lib/clock';
import { createId } from '@/shared/lib/id';
import { TrainingError } from './errors';
import {
  EQUIPMENT,
  EXERCISE_NAME_MAX_LENGTH,
  EXERCISE_TYPES,
  isOneOf,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  type Equipment,
  type Exercise,
  type ExerciseType,
  type MovementPattern,
  type MuscleGroup,
} from './exercise';
import { EXERCISE_CATALOG, EXERCISE_CATALOG_VERSION } from './exerciseCatalog';
import { requireName } from './names';
import type { TrainingStore } from './trainingStore';

export interface UserExerciseInput {
  name: string;
  exerciseType: ExerciseType;
  equipment: Equipment;
  movementPattern: MovementPattern;
  primaryMuscles: MuscleGroup[];
}

const CATALOG_VERSION_KEY = 'system.exerciseCatalogVersion';
const RECENT_LIMIT = 8;

export class ExerciseService {
  constructor(
    private readonly store: TrainingStore,
    private readonly clock: Clock,
  ) {}

  /** Brings the bundled catalog into the database; cheap no-op when already current. */
  async ensureCatalog(): Promise<void> {
    const version = String(EXERCISE_CATALOG_VERSION);
    if ((await this.store.readMeta(CATALOG_VERSION_KEY)) === version) return;
    const now = this.clock().toISOString();
    await this.store.atomic(async (repos) => {
      await repos.exercises.syncCatalog(EXERCISE_CATALOG, now);
    });
    await this.store.writeMeta(CATALOG_VERSION_KEY, version, now);
  }

  list(profileId: string, options?: { includeInactive?: boolean }): Promise<Exercise[]> {
    return this.store.repos.exercises.listForProfile(profileId, options);
  }

  get(id: string): Promise<Exercise | null> {
    return this.store.repos.exercises.findById(id);
  }

  favoriteIds(profileId: string): Promise<string[]> {
    return this.store.repos.exercises.favoriteIds(profileId);
  }

  /** Works for system and user exercises; only the profile's own favourite list changes. */
  async setFavorite(profileId: string, id: string, favorite: boolean): Promise<void> {
    const exercise = await this.store.repos.exercises.findById(id);
    if (!exercise || (exercise.source === 'user' && exercise.profileId !== profileId)) {
      throw new TrainingError('not-found');
    }
    const now = this.clock().toISOString();
    await this.store.repos.exercises.setFavorite(profileId, id, favorite, now);
  }

  /** Recently trained exercises, newest first, computed from the workout history. */
  recentIds(profileId: string, limit = RECENT_LIMIT): Promise<string[]> {
    return this.store.repos.exercises.recentIds(profileId, limit);
  }

  async create(profileId: string, input: UserExerciseInput): Promise<Exercise> {
    const exercise = this.toExercise(createId(), profileId, input);
    const now = this.clock().toISOString();
    await this.store.atomic((repos) => repos.exercises.insertUserExercise(exercise, now));
    return exercise;
  }

  /** Edits a user exercise. Past workouts keep their own name/type snapshot. */
  async update(profileId: string, id: string, input: UserExerciseInput): Promise<Exercise> {
    const existing = await this.store.repos.exercises.findById(id);
    if (existing?.source !== 'user' || existing.profileId !== profileId) {
      throw new TrainingError('not-found');
    }
    const exercise = { ...this.toExercise(id, profileId, input), active: existing.active };
    const now = this.clock().toISOString();
    const updated = await this.store.atomic((repos) =>
      repos.exercises.updateUserExercise(profileId, exercise, now),
    );
    if (!updated) throw new TrainingError('not-found');
    return exercise;
  }

  async setActive(profileId: string, id: string, active: boolean): Promise<void> {
    const now = this.clock().toISOString();
    if (!(await this.store.repos.exercises.setUserExerciseActive(profileId, id, active, now))) {
      throw new TrainingError('not-found');
    }
  }

  private toExercise(id: string, profileId: string, input: UserExerciseInput): Exercise {
    const name = requireName(input.name, EXERCISE_NAME_MAX_LENGTH);
    if (
      !isOneOf(EXERCISE_TYPES, input.exerciseType) ||
      !isOneOf(EQUIPMENT, input.equipment) ||
      !isOneOf(MOVEMENT_PATTERNS, input.movementPattern) ||
      !input.primaryMuscles.every((muscle) => isOneOf(MUSCLE_GROUPS, muscle))
    ) {
      throw new TrainingError('invalid-value');
    }
    return {
      id,
      source: 'user',
      profileId,
      // User names are not translated: the same text in every language.
      nameDe: name,
      nameEn: name,
      exerciseType: input.exerciseType,
      equipment: input.equipment,
      movementPattern: input.movementPattern,
      primaryMuscles: [...new Set(input.primaryMuscles)],
      secondaryMuscles: [],
      instructionsDe: null,
      instructionsEn: null,
      active: true,
    };
  }
}
