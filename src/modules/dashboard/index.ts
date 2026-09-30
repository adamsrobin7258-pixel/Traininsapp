import type { AppModule } from '@/app/moduleTypes';
import { ROUTES } from '@/app/routes';
import { DashboardScreen } from './screens/DashboardScreen';

export const dashboardModule: AppModule = {
  id: 'dashboard',
  path: ROUTES.dashboard,
  Screen: DashboardScreen,
  tab: { labelKey: 'nav.dashboard', icon: 'today' },
};
