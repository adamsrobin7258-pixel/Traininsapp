import { StorageService, type OpenedDatabase } from '@/core/database';
import { getPlatform, httpGetJson } from '@/core/platform';
import { createHealthPlatform, type HealthPlatform } from '@/core/platform/health';
import {
  combineActivities,
  countableActivityMinutes,
  dayActivityCalories,
  summarizeAllActivities,
  ManualActivityService,
  type ActivityWeightSource,
} from '@/core/activity';
import {
  ACTIVITY_WEIGHT_WINDOW_DAYS,
  HealthSyncService,
  mergeWeightDays,
  pickActivityWeight,
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
import { ProgressGoalService } from '@/core/progress';
import { RecoveryService } from '@/core/recovery';
import { ScoreService } from '@/core/score';
import { countsActivityCaloriesOn, TargetService } from '@/core/targets';
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
  /** Sport activities logged by hand – apart from workouts and Health Connect. */
  activities: ManualActivityService;
  /** The user's own daily recovery note (Kalethra score). */
  recovery: RecoveryService;
  /** Versioned personal targets (workouts and active minutes per week, steps per day). */
  targets: TargetService;
  /** Kalethra score – calculated from the data above, never stored. */
  score: ScoreService;
  /** Goal attainment on Fortschritt – the same sources as the score, never stored. */
  progress: ProgressGoalService;
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
  // Body weight for activity calories – weight rule 3 (core/health/weightRules.ts): the most
  // recent own or imported value. Nutrition goals keep reading the own entries only (rule 1).
  const activityWeight: ActivityWeightSource = {
    weightOn: async (profileId, localDate) => {
      const day = parseLocalDateKey(localDate);
      if (!day) return null;
      const [own, imported] = await Promise.all([
        weight.getLatestOnOrBefore(profileId, localDate),
        healthSync.weightsBetween(
          profileId,
          toLocalDateKey(addDays(day, -ACTIVITY_WEIGHT_WINDOW_DAYS)),
          localDate,
        ),
      ]);
      return pickActivityWeight(own, imported);
    },
  };
  const activities = new ManualActivityService(db, clock, activityWeight);
  // Versioned targets – also the switch "Aktivitätskalorien anrechnen" (kind activityCalories).
  const targets = new TargetService(db, clock);
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
  /**
   * The three activity sources of a period, loaded once for every reader (calorie budget,
   * score): imported and manual activities plus the completed Kalethra workouts – of the
   * neighbouring days too, since a workout may have started before midnight.
   */
  async function activitySourcesBetween(profileId: string, from: string, to: string) {
    const first = parseLocalDateKey(from);
    const last = parseLocalDateKey(to);
    if (!first || !last) return null;
    const [imported, manual, own] = await Promise.all([
      healthSync.workoutsBetween(profileId, from, to),
      activities.listBetween(profileId, from, to),
      training.workouts.completedSpansBetween(
        profileId,
        toLocalDateKey(addDays(first, -1)),
        toLocalDateKey(addDays(last, 1)),
      ),
    ]);
    return { imported, manual, own };
  }

  async function activityCaloriesBetween(profileId: string, from: string, to: string) {
    const result = new Map<string, { kcal: number; counted: number; excluded: number }>();
    const sources = await activitySourcesBetween(profileId, from, to);
    if (!sources) return result;
    const { imported, manual, own } = sources;
    const days = new Set([...imported, ...manual].map((activity) => activity.localDate));
    for (const day of days) {
      result.set(
        day,
        dayActivityCalories(
          imported.filter((activity) => activity.localDate === day),
          manual.filter((activity) => activity.localDate === day),
          own,
        ),
      );
    }
    return result;
  }

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
    // Imported and manual activities of a day: without sessions that are the same as a
    // completed Kalethra workout, and without manual entries that duplicate an import.
    activity: {
      caloriesOn: async (profileId, localDate) =>
        (await activityCaloriesBetween(profileId, localDate, localDate)).get(localDate) ?? {
          kcal: 0,
          counted: 0,
          excluded: 0,
        },
      caloriesBetween: activityCaloriesBetween,
      countingOn: async (profileId) => {
        const versions = (await targets.history(profileId)).activityCalories;
        return (localDate) => countsActivityCaloriesOn(versions, localDate);
      },
    },
  };
  const nutrition = createNutritionServices(
    new NutritionStore(db),
    clock,
    sources,
    foodProvider,
    referenceCatalog,
  );
  const recovery = new RecoveryService(db, clock);
  // Score and progress page read the same functions of the existing services – one definition
  // of workouts, countable activity minutes, nutrition days and goals, and targets for both.
  const shared = {
    nutritionTotals: (profileId: string, from: string, to: string) =>
      nutrition.diary.dailyTotalsBetween(profileId, from, to),
    nutritionGoals: (profileId: string, dates: readonly string[]) =>
      nutrition.goals.dayGoalsBetween(profileId, dates),
    workoutsPerDay: (profileId: string, from: string, to: string) =>
      training.workouts.dailyStatsBetween(profileId, from, to),
    activityMinutesPerDay: async (profileId: string, from: string, to: string) => {
      const sources = await activitySourcesBetween(profileId, from, to);
      return sources ? countableActivityMinutes(sources.imported, sources.manual, sources.own) : [];
    },
    targets: (profileId: string) => targets.history(profileId),
  };
  // The score reads the existing services; it has no data of its own.
  const score = new ScoreService({
    ...shared,
    goalTypeOn: async (profileId, localDate) =>
      (await nutrition.goals.goalFor(profileId, localDate))?.goal.goalType ?? null,
    recovery: async (profileId, from, to) =>
      (await recovery.listBetween(profileId, from, to)).map((entry) => ({
        localDate: entry.localDate,
        state: entry.state,
        restDay: entry.restDay,
      })),
  });
  const progress = new ProgressGoalService({
    ...shared,
    activitySummary: async (profileId, dates) => {
      const from = dates[0] ?? '';
      const to = dates.at(-1) ?? from;
      const sources = await activitySourcesBetween(profileId, from, to);
      return summarizeAllActivities(
        combineActivities(sources?.imported ?? [], sources?.manual ?? []),
        dates,
        sources?.own ?? [],
      );
    },
    // Steps come only from Health Connect – there is no manual step source.
    steps: async (profileId, from, to) =>
      (await healthSync.activityBetween(profileId, from, to)).map((day) => ({
        date: day.date,
        steps: day.steps,
      })),
    // Weight rule 2 (display): own entries win, Health Connect values are secondary.
    weights: async (profileId, from, to) => {
      const [ownInPeriod, ownLatest, importedInPeriod, importedLatest] = await Promise.all([
        weight.listBetween(profileId, from, to),
        weight.getLatestOnOrBefore(profileId, to),
        healthSync.weightsBetween(profileId, from, to),
        healthSync.latestWeight(profileId),
      ]);
      const withLatest = <T extends { date: string }>(list: T[], latest: T | null) =>
        latest && latest.date <= to && !list.some((entry) => entry.date === latest.date)
          ? [latest, ...list]
          : list;
      return mergeWeightDays(
        withLatest(ownInPeriod, ownLatest),
        withLatest(importedInPeriod, importedLatest),
      );
    },
  });
  return {
    activities,
    recovery,
    targets,
    score,
    progress,
    storage: new StorageService(db, security, clock),
    weight,
    healthSync,
    training,
    nutrition,
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
