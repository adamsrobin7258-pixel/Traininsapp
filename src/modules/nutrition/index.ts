import type { AppModule } from '@/app/moduleTypes';
import { ROUTES } from '@/app/routes';
import { NutritionScreen } from './screens/NutritionScreen';

export const nutritionModule: AppModule = {
  id: 'nutrition',
  path: ROUTES.nutrition,
  navLabelKey: 'nav.nutrition',
  icon: 'nutrition',
  Screen: NutritionScreen,
};
