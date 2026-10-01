import type { AppModule } from '@/app/moduleTypes';
import { ROUTES } from '@/app/routes';
import { FoodsScreen } from './screens/FoodsScreen';
import { MealsScreen } from './screens/MealsScreen';
import { NutritionProfileScreen } from './screens/NutritionProfileScreen';
import { NutritionScreen } from './screens/NutritionScreen';
import { TemplatesScreen } from './screens/TemplatesScreen';

export const nutritionModule: AppModule = {
  id: 'nutrition',
  path: ROUTES.nutrition,
  Screen: NutritionScreen,
  // Paths must match NUTRITION_LINKS in app/routes.ts.
  subRoutes: [
    { path: 'foods', Screen: FoodsScreen },
    { path: 'meals', Screen: MealsScreen },
    { path: 'templates', Screen: TemplatesScreen },
    { path: 'profile', Screen: NutritionProfileScreen },
  ],
  tab: { labelKey: 'nav.nutrition', icon: 'nutrition' },
};
