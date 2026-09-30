import { StorageService, type OpenedDatabase } from '@/core/database';
import { WeightRepository, WeightService } from '@/core/health';
import {
  ExerciseService,
  PlanService,
  TrainingStore,
  WorkoutService,
  type TrainingServices,
} from '@/core/training';
import { SettingsRepository, SettingsService, type AppSettings } from '@/core/settings';
import { LocalOnlySyncService, type SyncService } from '@/core/sync';
import { ProfileRepository, ProfileService, type Profile } from '@/core/user';
import { systemClock, type Clock } from '@/shared/lib/clock';

/** Composition root: wires repositories and services to one database connection. */
export interface AppServices {
  settings: SettingsService;
  profile: ProfileService;
  sync: SyncService;
  storage: StorageService;
  weight: WeightService;
  training: TrainingServices;
}

export function createServices(
  { driver: db, security }: OpenedDatabase,
  clock: Clock = systemClock,
): AppServices {
  return {
    storage: new StorageService(db, security, clock),
    weight: new WeightService(new WeightRepository(db), clock),
    training: createTrainingServices(new TrainingStore(db), clock),
    settings: new SettingsService(new SettingsRepository(db, clock)),
    profile: new ProfileService(new ProfileRepository(db), clock),
    sync: new LocalOnlySyncService(),
  };
}

function createTrainingServices(store: TrainingStore, clock: Clock): TrainingServices {
  return {
    exercises: new ExerciseService(store, clock),
    plans: new PlanService(store, clock),
    workouts: new WorkoutService(store, clock),
  };
}

export interface InitialState {
  settings: AppSettings;
  profile: Profile;
}

export async function loadInitialState(services: AppServices): Promise<InitialState> {
  const [settings, profile] = await Promise.all([
    services.settings.load(),
    services.profile.ensureLocalProfile(),
  ]);
  // Keeps the bundled exercise catalog current; a no-op when the version is unchanged.
  await services.training.exercises.ensureCatalog();
  return { settings, profile };
}
