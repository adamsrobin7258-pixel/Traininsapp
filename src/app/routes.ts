/**
 * Route paths of all top-level areas. Kept free of imports so any module can link
 * to another area without creating import cycles.
 */
export const ROUTES = {
  /** The main page: progress over the last 7 or 30 days. */
  progress: '/',
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
  /** Activities imported from Health Connect – kept apart from Kalethra's own workouts. */
  activities: `${ROUTES.training}/activities`,
  exercises: `${ROUTES.training}/exercises`,
  plans: `${ROUTES.training}/plans`,
  workout: (id: string) => `${ROUTES.training}/workouts/${id}`,
  plan: (id: string) => `${ROUTES.training}/plans/${id}`,
} as const;

/** Sub pages of the nutrition area; `day` opens the diary on a local day (YYYY-MM-DD). */
export const NUTRITION_LINKS = {
  day: (localDate: string) => `${ROUTES.nutrition}?day=${localDate}`,
  foods: `${ROUTES.nutrition}/foods`,
  meals: `${ROUTES.nutrition}/meals`,
  templates: `${ROUTES.nutrition}/templates`,
  profile: `${ROUTES.nutrition}/profile`,
} as const;
