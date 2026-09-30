import { dashboardModule } from '@/modules/dashboard';
import { healthModule } from '@/modules/health';
import { nutritionModule } from '@/modules/nutrition';
import { profileModule } from '@/modules/profile';
import { trainingModule } from '@/modules/training';
import type { AppModule } from './moduleTypes';

/** Top-level areas in tab-bar order. Registering a module here adds its route and tab. */
export const appModules: readonly AppModule[] = [
  dashboardModule,
  trainingModule,
  nutritionModule,
  healthModule,
  profileModule,
];
