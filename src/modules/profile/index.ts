import type { AppModule } from '@/app/moduleTypes';
import { ROUTES } from '@/app/routes';
import { ProfileScreen } from './screens/ProfileScreen';

export const profileModule: AppModule = {
  id: 'profile',
  path: ROUTES.profile,
  navLabelKey: 'nav.profile',
  icon: 'profile',
  Screen: ProfileScreen,
};
