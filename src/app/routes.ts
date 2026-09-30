/**
 * Route paths of all top-level areas. Kept free of imports so any module can link
 * to another area without creating import cycles.
 */
export const ROUTES = {
  dashboard: '/',
  training: '/training',
  nutrition: '/nutrition',
  health: '/health',
  profile: '/profile',
} as const;

export type ModuleId = keyof typeof ROUTES;

/** Query parameters shared between areas (kept here so modules stay independent). */
export const ROUTE_PARAMS = {
  /** Health screen: open the weight entry for a day, YYYY-MM-DD. */
  addWeight: 'add',
} as const;

/** Sub pages of the training area. */
export const TRAINING_LINKS = {
  activeWorkout: `${ROUTES.training}/workout`,
  exercises: `${ROUTES.training}/exercises`,
  plans: `${ROUTES.training}/plans`,
  workout: (id: string) => `${ROUTES.training}/workouts/${id}`,
  plan: (id: string) => `${ROUTES.training}/plans/${id}`,
} as const;
