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
