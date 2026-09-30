import { StorageService, type OpenedDatabase } from '@/core/database';
import { WeightRepository, WeightService } from '@/core/health';
import {
  ExerciseService,
  PlanService,
  TrainingStore,
  WorkoutService,
  type TrainingServices,
} from '@/core/training';
import {
  DiaryService,
  FoodService,
  GoalService,
  MealService,
  NutritionStore,
  RecipeService,
  type BodyWeightSource,
  type NutritionServices,
} from '@/core/nutrition';
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
  nutrition: NutritionServices;
  /** Read-only view on body weight for nutrition (weight itself lives in health). */
  bodyWeight: BodyWeightSource;
}

export function createServices(
  { driver: db, security }: OpenedDatabase,
  clock: Clock = systemClock,
): AppServices {
  const weight = new WeightService(new WeightRepository(db), clock);
  return {
    storage: new StorageService(db, security, clock),
    weight,
    training: createTrainingServices(new TrainingStore(db), clock),
    nutrition: createNutritionServices(new NutritionStore(db), clock),
    bodyWeight: {
      latestKgOnOrBefore: async (profileId, localDate) =>
        (await weight.getLatestOnOrBefore(profileId, localDate))?.kg ?? null,
    },
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

function createNutritionServices(store: NutritionStore, clock: Clock): NutritionServices {
  return {
    foods: new FoodService(store, clock),
    meals: new MealService(store, clock),
    diary: new DiaryService(store, clock),
    recipes: new RecipeService(store, clock),
    goals: new GoalService(store, clock),
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
  // Every profile starts with the four default meals; a no-op once they exist.
  await services.nutrition.meals.ensureDefaults(profile.id);
  return { settings, profile };
}
