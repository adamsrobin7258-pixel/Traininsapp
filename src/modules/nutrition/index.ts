import type { AppModule } from '@/app/moduleTypes';
import { ROUTES } from '@/app/routes';
import { NutritionScreen } from './screens/NutritionScreen';

export const nutritionModule: AppModule = {
  id: 'nutrition',
  path: ROUTES.nutrition,
  Screen: NutritionScreen,
  tab: { labelKey: 'nav.nutrition', icon: 'nutrition' },
};
