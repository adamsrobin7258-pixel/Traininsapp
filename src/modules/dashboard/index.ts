import type { AppModule } from '@/app/moduleTypes';
import { ROUTES } from '@/app/routes';
import { DashboardScreen } from './screens/DashboardScreen';

export const dashboardModule: AppModule = {
  id: 'dashboard',
  path: ROUTES.dashboard,
  navLabelKey: 'nav.dashboard',
  icon: 'today',
  Screen: DashboardScreen,
};
