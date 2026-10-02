import { StorageService, type OpenedDatabase } from '@/core/database';
import { getPlatform, httpGetJson } from '@/core/platform';
import { createHealthPlatform, type HealthPlatform } from '@/core/platform/health';
import {
  countableActivityCalories,
  HealthSyncService,
  WeightRepository,
  WeightService,
} from '@/core/health';
import {
  ExerciseService,
  getTrainingType,
  PlanService,
  TrainingStore,
  WorkoutService,
  type TrainingServices,
} from '@/core/training';
import {
  DiaryService,
  FoodLookupService,
  FoodService,
  OpenFoodFactsProvider,
  type FoodDataProvider,
  GoalService,
  MealService,
  NutritionStore,
  RecipeService,
  type BodyWeightSource,
  type NutritionServices,
  type NutritionSources,
  type ReferenceCatalog,
} from '@/core/nutrition';
import { createBlsCatalog } from '@/core/nutrition/bls';
import { SettingsRepository, SettingsService, type AppSettings } from '@/core/settings';
import { LocalOnlySyncService, type SyncService } from '@/core/sync';
import { ProfileRepository, ProfileService, type Profile } from '@/core/user';
import { systemClock, type Clock } from '@/shared/lib/clock';
import { addDays, parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';

/** Composition root: wires repositories and services to one database connection. */
export interface AppServices {
  settings: SettingsService;
  profile: ProfileService;
  sync: SyncService;
  storage: StorageService;
  weight: WeightService;
  /** Health Connect import (read-only, local). Never writes Kalethra's own weight. */
  healthSync: HealthSyncService;
  training: TrainingServices;
  nutrition: NutritionServices;
  /** Read-only view on body weight for nutrition (weight itself lives in health). */
  bodyWeight: BodyWeightSource;
}

export function createServices(
  { driver: db, security }: OpenedDatabase,
  clock: Clock = systemClock,
  /** The external food database; tests pass a fake – real requests never run in tests. */
  foodProvider: FoodDataProvider = createFoodProvider(),
  /** Bundled reference data (BLS) for the offline food search. */
  referenceCatalog: ReferenceCatalog = createBlsCatalog(),
  /** The device's health store; tests pass a fake. */
  healthPlatform: HealthPlatform = createHealthPlatform(),
): AppServices {
  const weight = new WeightService(new WeightRepository(db), clock);
  const profile = new ProfileService(new ProfileRepository(db), clock);
  const training = createTrainingServices(new TrainingStore(db), clock);
  const healthSync = new HealthSyncService(healthPlatform, db, clock);
  const bodyWeight: BodyWeightSource = {
    latestKgOnOrBefore: async (profileId, localDate) =>
      (await weight.getLatestOnOrBefore(profileId, localDate))?.kg ?? null,
    latestOnOrBefore: async (profileId, localDate) => {
      const entry = await weight.getLatestOnOrBefore(profileId, localDate);
      return entry ? { date: entry.date, kg: entry.kg } : null;
    },
    pointsBetween: async (profileId, from, to) =>
      (await weight.listBetween(profileId, from, to)).map((e) => ({ date: e.date, kg: e.kg })),
  };
  // Nutrition reads weight, workouts and body data from their owners – it copies nothing.
  const sources: NutritionSources = {
    bodyWeight,
    personal: { get: (profileId) => profile.getBodyData(profileId) },
    training: {
      sessionsBetween: async (profileId, from, to) =>
        (await training.workouts.completedBetween(profileId, from, to)).map((w) => ({
          localDate: w.localDate,
          durationMinutes: (w.durationS ?? 0) / 60,
          category: getTrainingType(w.trainingType).category,
        })),
    },
    // Imported activities of a day, without sessions that are the same as a completed Kalethra
    // workout (e.g. a watch recording the gym session that was also logged here).
    activity: {
      caloriesOn: async (profileId, localDate) => {
        const day = parseLocalDateKey(localDate);
        if (!day) return { kcal: 0, counted: 0, excluded: 0 };
        // Neighbouring days too: a Kalethra workout may have started before midnight.
        const [activities, own] = await Promise.all([
          healthSync.workoutsBetween(profileId, localDate, localDate),
          training.workouts.completedSpansBetween(
            profileId,
            toLocalDateKey(addDays(day, -1)),
            toLocalDateKey(addDays(day, 1)),
          ),
        ]);
        return countableActivityCalories(activities, own);
      },
      caloriesBetween: async (profileId, from, to) => {
        const first = parseLocalDateKey(from);
        const last = parseLocalDateKey(to);
        if (!first || !last) return new Map();
        const [activities, own] = await Promise.all([
          healthSync.workoutsBetween(profileId, from, to),
          training.workouts.completedSpansBetween(
            profileId,
            toLocalDateKey(addDays(first, -1)),
            toLocalDateKey(addDays(last, 1)),
          ),
        ]);
        const byDay = new Map<string, typeof activities>();
        for (const activity of activities) {
          byDay.set(activity.localDate, [...(byDay.get(activity.localDate) ?? []), activity]);
        }
        return new Map(
          [...byDay].map(([day, list]) => [day, countableActivityCalories(list, own)] as const),
        );
      },
    },
  };
  return {
    storage: new StorageService(db, security, clock),
    weight,
    healthSync,
    training,
    nutrition: createNutritionServices(
      new NutritionStore(db),
      clock,
      sources,
      foodProvider,
      referenceCatalog,
    ),
    bodyWeight,
    settings: new SettingsService(new SettingsRepository(db, clock)),
    profile,
    sync: new LocalOnlySyncService(),
  };
}

/**
 * Open Food Facts (barcode fallback only) over the platform's HTTP client. The User-Agent names the app, its version
 * and platform – nothing about the user.
 */
function createFoodProvider(): FoodDataProvider {
  return new OpenFoodFactsProvider(
    { getJson: (url, options) => httpGetJson(url, options) },
    `Kalethra/${__APP_VERSION__} (${getPlatform()})`,
  );
}

function createTrainingServices(store: TrainingStore, clock: Clock): TrainingServices {
  return {
    exercises: new ExerciseService(store, clock),
    plans: new PlanService(store, clock),
    workouts: new WorkoutService(store, clock),
  };
}

function createNutritionServices(
  store: NutritionStore,
  clock: Clock,
  sources: NutritionSources,
  provider: FoodDataProvider,
  reference: ReferenceCatalog,
): NutritionServices {
  const foods = new FoodService(store, clock);
  return {
    foods,
    lookup: new FoodLookupService(foods, provider, reference),
    meals: new MealService(store, clock),
    diary: new DiaryService(store, clock),
    recipes: new RecipeService(store, clock),
    goals: new GoalService(store, clock, sources),
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
  // Automatic nutrition goals follow the weight trend; only a relevant change is stored.
  await services.nutrition.goals.refreshAutomatic(profile.id);
  return { settings, profile };
}
