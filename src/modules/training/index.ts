import type { AppModule } from '@/app/moduleTypes';
import { ROUTES } from '@/app/routes';
import { ActiveWorkoutScreen } from './screens/ActiveWorkoutScreen';
import { ExercisesScreen } from './screens/ExercisesScreen';
import { PlanScreen } from './screens/PlanScreen';
import { TrainingScreen } from './screens/TrainingScreen';
import { WorkoutDetailScreen } from './screens/WorkoutDetailScreen';

export const trainingModule: AppModule = {
  id: 'training',
  path: ROUTES.training,
  Screen: TrainingScreen,
  // Paths must match TRAINING_LINKS in app/routes.ts.
  subRoutes: [
    { path: 'workout', Screen: ActiveWorkoutScreen },
    { path: 'workouts/:workoutId', Screen: WorkoutDetailScreen },
    { path: 'plans/:planId', Screen: PlanScreen },
    { path: 'exercises', Screen: ExercisesScreen },
  ],
  tab: { labelKey: 'nav.training', icon: 'training' },
};
