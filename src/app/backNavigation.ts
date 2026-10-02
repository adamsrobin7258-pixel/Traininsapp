import { matchPath } from 'react-router';
import { ROUTES, SETTINGS_LINKS } from './routes';
import type { AppModule } from './moduleTypes';

/** Full path of a module's content page below Einstellungen → Meine Inhalte. */
export function contentRoutePath(path: string): string {
  return `${SETTINGS_LINKS.content}/${path}`;
}

/** All route patterns of the app, derived from the module registry (single source). */
export function routePatterns(modules: readonly AppModule[]): string[] {
  return modules.flatMap((module) => [
    module.path,
    ...(module.subRoutes ?? []).map((sub) => `${module.path}/${sub.path}`),
    ...(module.contentRoutes ?? []).map((sub) => contentRoutePath(sub.path)),
  ]);
}

/**
 * Where the system back action leads from `pathname`: one level up in the route hierarchy.
 *
 * - A nested page goes to the nearest ancestor path that is a page itself
 *   (`/settings/content/plans/:id` → `/settings/content/plans` → `/settings/content`,
 *   `/training/workouts/:id` → `/training`).
 * - A tab's start page goes to Fortschritt.
 * - Fortschritt returns `null`: nothing is above it, the app may close.
 *
 * Leaving a page never changes data – an active workout stays as it is.
 */
export function backTarget(pathname: string, patterns: readonly string[]): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  for (let length = segments.length - 1; length >= 1; length--) {
    const candidate = `/${segments.slice(0, length).join('/')}`;
    if (patterns.some((pattern) => matchPath({ path: pattern, end: true }, candidate))) {
      return candidate;
    }
  }
  return ROUTES.progress;
}
