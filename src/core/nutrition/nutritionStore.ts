import type { DatabaseDriver, SqlExecutor } from '@/core/database';
import { DiaryRepository } from './diaryRepository';
import { FoodRepository } from './foodRepository';
import { GoalRepository } from './goalRepository';
import { MealRepository } from './mealRepository';
import { RecipeRepository } from './recipeRepository';

export interface NutritionRepositories {
  foods: FoodRepository;
  meals: MealRepository;
  diary: DiaryRepository;
  recipes: RecipeRepository;
  goals: GoalRepository;
}

function repositories(db: SqlExecutor): NutritionRepositories {
  return {
    foods: new FoodRepository(db),
    meals: new MealRepository(db),
    diary: new DiaryRepository(db),
    recipes: new RecipeRepository(db),
    goals: new GoalRepository(db),
  };
}

/** Repositories for single statements and atomic multi-step changes (like TrainingStore). */
export class NutritionStore {
  readonly repos: NutritionRepositories;

  constructor(private readonly db: DatabaseDriver) {
    this.repos = repositories(db);
  }

  atomic<T>(work: (repos: NutritionRepositories) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(repositories(tx)));
  }
}
