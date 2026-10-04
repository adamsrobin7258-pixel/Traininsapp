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
  /** Einstellungen: profile, goals, own content and app settings. */
  settings: '/settings',
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
  workout: (id: string) => `${ROUTES.training}/workouts/${id}`,
} as const;

/**
 * Screens that are a mode of their own: the tab bar is hidden there, so a stray tap cannot leave
 * them (the workout in progress). Back and system back still work; nothing is lost.
 */
export const FOCUS_ROUTES: readonly string[] = [TRAINING_LINKS.activeWorkout];

/** Sub pages of the nutrition area; `day` opens the diary on a local day (YYYY-MM-DD). */
export const NUTRITION_LINKS = {
  day: (localDate: string) => `${ROUTES.nutrition}?day=${localDate}`,
} as const;

/**
 * The pages of Einstellungen – the only place where the user defines what they want to reach
 * (profile, goals) and how Kalethra is set up (app). The areas record what actually happened.
 */
export const SETTINGS_LINKS = {
  profile: `${ROUTES.settings}/profile`,
  goals: `${ROUTES.settings}/goals`,
  content: `${ROUTES.settings}/content`,
  app: `${ROUTES.settings}/app`,
} as const;

/**
 * Einstellungen → Meine Inhalte: the management of the user's own content. The pages belong to
 * their areas (nutrition, training) and are mounted here through `AppModule.contentRoutes`;
 * the areas themselves only track and offer quick access (e.g. a new food while logging).
 */
export const CONTENT_LINKS = {
  foods: `${SETTINGS_LINKS.content}/foods`,
  meals: `${SETTINGS_LINKS.content}/meals`,
  templates: `${SETTINGS_LINKS.content}/templates`,
  template: (id: string) => `${SETTINGS_LINKS.content}/templates/${id}`,
  recipes: `${SETTINGS_LINKS.content}/recipes`,
  plans: `${SETTINGS_LINKS.content}/plans`,
  plan: (id: string) => `${SETTINGS_LINKS.content}/plans/${id}`,
  exercises: `${SETTINGS_LINKS.content}/exercises`,
} as const;

/**
 * Old addresses that moved; they redirect (replacing the history entry) so saved links and
 * deep links keep working – otherwise the catch-all route would silently open Fortschritt.
 * `:params` in `from` are carried over into `to`. Navigation inside the app uses the new
 * addresses directly.
 */
export const LEGACY_REDIRECTS: readonly { from: string; to: string }[] = [
  { from: '/profile', to: ROUTES.settings },
  { from: '/nutrition/profile', to: SETTINGS_LINKS.goals },
  { from: '/nutrition/foods', to: CONTENT_LINKS.foods },
  { from: '/nutrition/meals', to: CONTENT_LINKS.meals },
  { from: '/nutrition/templates', to: CONTENT_LINKS.templates },
  { from: '/training/plans', to: CONTENT_LINKS.plans },
  { from: '/training/plans/:planId', to: CONTENT_LINKS.plan(':planId') },
  { from: '/training/exercises', to: CONTENT_LINKS.exercises },
];
