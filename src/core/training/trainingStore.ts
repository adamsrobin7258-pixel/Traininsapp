import type { DatabaseDriver, SqlExecutor } from '@/core/database';
import { ExerciseRepository } from './exerciseRepository';
import { PlanRepository } from './planRepository';
import { WorkoutRepository } from './workoutRepository';

export interface TrainingRepositories {
  exercises: ExerciseRepository;
  plans: PlanRepository;
  workouts: WorkoutRepository;
}

function repositories(db: SqlExecutor): TrainingRepositories {
  return {
    exercises: new ExerciseRepository(db),
    plans: new PlanRepository(db),
    workouts: new WorkoutRepository(db),
  };
}

/** Gives services repositories for single statements and for atomic multi-step changes. */
export class TrainingStore {
  readonly repos: TrainingRepositories;

  constructor(private readonly db: DatabaseDriver) {
    this.repos = repositories(db);
  }

  /** Runs `work` in one transaction: all changes are saved together or not at all. */
  atomic<T>(work: (repos: TrainingRepositories) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(repositories(tx)));
  }

  /** Technical key/value storage for the catalog version (app_settings, not synced). */
  async readMeta(key: string): Promise<string | null> {
    const rows = await this.db.query<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [key],
    );
    return rows[0]?.value ?? null;
  }

  async writeMeta(key: string, value: string, now: string): Promise<void> {
    await this.db.run(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, now],
    );
  }
}
