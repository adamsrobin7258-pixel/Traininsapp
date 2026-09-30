import type { AppModule } from '@/app/moduleTypes';
import { ROUTES } from '@/app/routes';
import { HealthScreen } from './screens/HealthScreen';

export const healthModule: AppModule = {
  id: 'health',
  path: ROUTES.health,
  navLabelKey: 'nav.health',
  icon: 'health',
  Screen: HealthScreen,
};
