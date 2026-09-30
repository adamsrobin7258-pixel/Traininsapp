import type { AppModule } from '@/app/moduleTypes';
import { ROUTES } from '@/app/routes';
import { TrainingScreen } from './screens/TrainingScreen';

export const trainingModule: AppModule = {
  id: 'training',
  path: ROUTES.training,
  navLabelKey: 'nav.training',
  icon: 'training',
  Screen: TrainingScreen,
};
