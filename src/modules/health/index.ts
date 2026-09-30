import type { AppModule } from '@/app/moduleTypes';
import { ROUTES } from '@/app/routes';
import { HealthScreen } from './screens/HealthScreen';

export const healthModule: AppModule = {
  id: 'health',
  path: ROUTES.health,
  Screen: HealthScreen,
  tab: { labelKey: 'nav.health', icon: 'health' },
};
