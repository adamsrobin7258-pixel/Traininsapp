import { progressModule } from '@/modules/progress';
import { healthModule } from '@/modules/health';
import { nutritionModule } from '@/modules/nutrition';
import { settingsModule } from '@/modules/settings';
import { trainingModule } from '@/modules/training';
import type { AppModule } from './moduleTypes';

/** Top-level areas in tab-bar order. Registering a module here adds its route and tab. */
export const appModules: readonly AppModule[] = [
  progressModule,
  trainingModule,
  nutritionModule,
  healthModule,
  settingsModule,
];
