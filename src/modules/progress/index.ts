import type { AppModule } from '@/app/moduleTypes';
import { ROUTES } from '@/app/routes';
import { ProgressScreen } from './screens/ProgressScreen';

export const progressModule: AppModule = {
  id: 'progress',
  path: ROUTES.progress,
  Screen: ProgressScreen,
  tab: { labelKey: 'nav.progress', icon: 'progress' },
};
