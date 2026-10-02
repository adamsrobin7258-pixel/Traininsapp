import type { AppModule } from '@/app/moduleTypes';
import { ROUTES } from '@/app/routes';
import { ActiveWorkoutScreen } from './screens/ActiveWorkoutScreen';
import { ActivitiesScreen } from './screens/ActivitiesScreen';
import { ExercisesScreen } from './screens/ExercisesScreen';
import { PlanScreen } from './screens/PlanScreen';
import { PlansScreen } from './screens/PlansScreen';
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
    { path: 'activities', Screen: ActivitiesScreen },
  ],
  // Managed under Einstellungen → Meine Inhalte; paths must match CONTENT_LINKS in app/routes.ts.
  contentRoutes: [
    { path: 'plans', Screen: PlansScreen },
    { path: 'plans/:planId', Screen: PlanScreen },
    { path: 'exercises', Screen: ExercisesScreen },
  ],
  tab: { labelKey: 'nav.training', icon: 'training' },
};
