import { matchPath } from 'react-router';
import { routePatterns } from './backNavigation';
import { appModules } from './modules';
import { createRoutes } from './router';
import { CONTENT_LINKS, LEGACY_REDIRECTS, SETTINGS_LINKS } from './routes';

/** Source of every feature module file, keyed by its path below `/src/modules/`. */
const sources = import.meta.glob<string>('/src/modules/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const IMPORT = /(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function moduleOf(file: string): string {
  return file.split('/')[3] ?? '';
}

/** The feature module a specifier points to, if it points into another module at all. */
function targetModule(file: string, specifier: string): string | null {
  if (specifier.startsWith('@/modules/')) return specifier.split('/')[2] ?? null;
  if (!specifier.startsWith('.')) return null;
  const parts = file.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.') parts.push(part);
  }
  return parts[1] === 'src' && parts[2] === 'modules' ? (parts[3] ?? null) : null;
}

describe('module isolation', () => {
  it('finds the feature modules', () => {
    const modules = new Set(Object.keys(sources).map(moduleOf));
    expect([...modules].sort()).toEqual([
      'health',
      'nutrition',
      'progress',
      'settings',
      'training',
    ]);
  });

  it('no feature module imports another one or the app shell (except routes and types)', () => {
    const violations: string[] = [];
    // Production code only – tests may wire the whole app (same rule as the ESLint layers).
    const production = Object.entries(sources).filter(([file]) => !/\.test\.tsx?$/.test(file));
    expect(production.length).toBeGreaterThan(50);
    for (const [file, source] of production) {
      for (const match of source.matchAll(IMPORT)) {
        const specifier = match[1] ?? match[2] ?? '';
        const target = targetModule(file, specifier);
        if (target !== null && target !== moduleOf(file)) {
          violations.push(`${file} → ${specifier}`);
        }
        if (
          specifier.startsWith('@/app') &&
          specifier !== '@/app/routes' &&
          specifier !== '@/app/moduleTypes'
        ) {
          violations.push(`${file} → ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('content routes (Einstellungen → Meine Inhalte)', () => {
  const patterns = routePatterns(appModules);
  const contentPatterns = appModules.flatMap((module) =>
    (module.contentRoutes ?? []).map((route) => `${SETTINGS_LINKS.content}/${route.path}`),
  );

  it('are provided by the areas that own the content, not by Einstellungen', () => {
    const owners = Object.fromEntries(
      appModules.map((module) => [module.id, (module.contentRoutes ?? []).map((r) => r.path)]),
    );
    expect(owners).toEqual({
      progress: [],
      training: ['plans', 'plans/:planId', 'exercises'],
      nutrition: ['foods', 'meals', 'templates'],
      health: [],
      settings: [],
    });
  });

  it('every content link points to a registered page', () => {
    const links = [
      CONTENT_LINKS.foods,
      CONTENT_LINKS.meals,
      CONTENT_LINKS.templates,
      CONTENT_LINKS.plans,
      CONTENT_LINKS.plan('abc'),
      CONTENT_LINKS.exercises,
    ];
    for (const link of links) {
      expect(contentPatterns.some((pattern) => matchPath(pattern, link))).toBe(true);
      expect(patterns.some((pattern) => matchPath(pattern, link))).toBe(true);
    }
  });

  it('each page exists once: the old area addresses are only redirects', () => {
    const [layout] = createRoutes();
    const paths = (layout?.children ?? []).flatMap((route) => [
      route.path,
      ...(route.children ?? []).map((child) => `${route.path}/${child.path ?? ''}`),
    ]);
    for (const { from } of LEGACY_REDIRECTS) {
      expect(patterns).not.toContain(from);
    }
    for (const pattern of contentPatterns) {
      expect(paths.filter((path) => path === pattern)).toHaveLength(1);
    }
  });
});
