import {
  EXERCISE_CATALOG,
  FIGURE_MUSCLES,
  muscleHighlight,
  type FigureMuscle,
  type MuscleHighlight,
} from '@/core/training';
import {
  MUSCLE_MAP_VARIANTS,
  MUSCLE_MAP_VIEWS,
  MUSCLE_REGIONS,
  MUSCLE_REGION_IDS,
  highlightSvg,
  regionGroup,
  regionLevel,
} from './regions';
import { MUSCLE_MAP_SVGS } from './svgs';

const SVG_DIR = 'src/modules/training/muscleMap/svg';

/**
 * The bit of Node the generator check needs. The app's TypeScript setup has no Node types on
 * purpose (see src/test/projectFiles.ts), so the modules are loaded by name at run time.
 */
interface NodeApi {
  execFileSync: (command: string, args: string[], options: object) => unknown;
  mkdtempSync: (prefix: string) => string;
  readFileSync: (path: string, encoding: 'utf8') => string;
  rmSync: (path: string, options: object) => void;
  tmpdir: () => string;
  join: (...parts: string[]) => string;
}

async function node(): Promise<NodeApi> {
  const load = async (name: string) => (await import(/* @vite-ignore */ name)) as object;
  const names: string[] = ['node:child_process', 'node:fs', 'node:os', 'node:path'];
  return Object.assign({}, ...(await Promise.all(names.map(load)))) as NodeApi;
}

/** Region id + side of every muscle path of a drawing, in document order. */
function regionsOf(svg: string): string[] {
  return [...svg.matchAll(/data-region="([^"]+)" data-side="(left|right)"/g)].map(
    ([, id, side]) => `${id ?? ''}:${side ?? ''}`,
  );
}

const idsOf = (svg: string) => new Set(regionsOf(svg).map((entry) => entry.split(':')[0]));

/** Level per region (and side) after highlighting. */
function marked(svg: string): Map<string, string> {
  return new Map(
    [...svg.matchAll(/data-region="([^"]+)" data-level="(\w+)" data-side="(left|right)"/g)].map(
      ([, id, level, side]) => [`${id ?? ''}:${side ?? ''}`, level ?? ''],
    ),
  );
}

const catalog = (id: string) => {
  const entry = EXERCISE_CATALOG.find((exercise) => exercise.id === id);
  if (!entry) throw new Error(id);
  return { primaryMuscles: entry.primary, secondaryMuscles: entry.secondary };
};

describe('muscle ids', () => {
  it('uses only known, stable ids – in every drawing, on both sides', () => {
    for (const variant of MUSCLE_MAP_VARIANTS) {
      for (const view of MUSCLE_MAP_VIEWS) {
        const regions = regionsOf(MUSCLE_MAP_SVGS[variant][view]);
        expect(regions.length).toBeGreaterThan(30);
        for (const entry of regions) {
          const [id = ''] = entry.split(':');
          expect(MUSCLE_REGION_IDS, `${variant}-${view}: ${id}`).toContain(id);
        }
        // Each region once per side, and paired.
        expect(new Set(regions).size).toBe(regions.length);
        for (const id of idsOf(MUSCLE_MAP_SVGS[variant][view])) {
          expect(regions).toContain(`${id}:left`);
          expect(regions).toContain(`${id}:right`);
        }
      }
    }
  });

  it('gives the male and the female body exactly the same regions', () => {
    for (const view of MUSCLE_MAP_VIEWS) {
      expect(regionsOf(MUSCLE_MAP_SVGS.female[view])).toEqual(
        regionsOf(MUSCLE_MAP_SVGS.male[view]),
      );
    }
  });

  it('draws every id somewhere and every muscle group of the library on both bodies', () => {
    const drawn = new Set(
      MUSCLE_MAP_VIEWS.flatMap((view) => [...idsOf(MUSCLE_MAP_SVGS.male[view])]),
    );
    expect([...drawn].sort()).toEqual([...MUSCLE_REGION_IDS].sort());
    for (const variant of MUSCLE_MAP_VARIANTS) {
      const groups = new Set(
        MUSCLE_MAP_VIEWS.flatMap((view) =>
          [...idsOf(MUSCLE_MAP_SVGS[variant][view])].map((id = '') => regionGroup(id)),
        ),
      );
      for (const group of FIGURE_MUSCLES) expect(groups, `${variant}: ${group}`).toContain(group);
    }
  });

  it('maps regions to groups as documented; orientation muscles have none', () => {
    expect(regionGroup('pectoralis-major')).toBe('chest');
    expect(regionGroup('trapezius')).toBe('back');
    expect(regionGroup('erector-spinae')).toBe('back');
    expect(regionGroup('external-oblique')).toBe('core');
    expect(regionGroup('gluteus-medius')).toBe('glutes');
    expect(regionGroup('soleus')).toBe('calves');
    for (const id of ['serratus-anterior', 'brachialis', 'sartorius', 'tibialis-anterior']) {
      expect(regionGroup(id)).toBeNull();
    }
    // Unknown ids (also prototype keys) never belong to a group.
    expect(regionGroup('toString')).toBeNull();
    expect(regionGroup('biceps')).toBeNull();
    const groups = Object.values(MUSCLE_REGIONS).filter((group) => group !== null);
    for (const group of groups) expect(FIGURE_MUSCLES).toContain(group);
  });
});

describe('highlighting', () => {
  it('marks exactly the regions of the exercise groups, primary stronger than secondary', () => {
    const highlight = muscleHighlight(catalog('sys.bench-press'));
    for (const variant of MUSCLE_MAP_VARIANTS) {
      const front = marked(highlightSvg(MUSCLE_MAP_SVGS[variant].front, highlight));
      expect(front.get('pectoralis-major:left')).toBe('primary');
      expect(front.get('pectoralis-major:right')).toBe('primary');
      expect(front.get('deltoid-anterior:left')).toBe('secondary');
      expect(front.get('triceps-brachii:right')).toBe('secondary');
      expect(front.has('biceps-brachii:left')).toBe(false);
      expect(front.has('rectus-abdominis:left')).toBe(false);
      const back = marked(highlightSvg(MUSCLE_MAP_SVGS[variant].back, highlight));
      expect(back.get('deltoid-posterior:left')).toBe('secondary');
      expect(back.has('latissimus-dorsi:left')).toBe(false);
      expect(back.has('trapezius:left')).toBe(false);
    }
  });

  it('never marks anything without a highlight, and never orientation muscles', () => {
    const all = Object.fromEntries(
      FIGURE_MUSCLES.map((group) => [group, 'primary']),
    ) as MuscleHighlight;
    for (const variant of MUSCLE_MAP_VARIANTS) {
      for (const view of MUSCLE_MAP_VIEWS) {
        const svg = MUSCLE_MAP_SVGS[variant][view];
        expect(highlightSvg(svg, {})).toBe(svg);
        const levels = marked(highlightSvg(svg, all));
        for (const [entry] of levels) {
          expect(regionGroup(entry.split(':')[0] ?? '')).not.toBeNull();
        }
        expect(levels.has('serratus-anterior:left')).toBe(false);
        expect(levels.has('sartorius:left')).toBe(false);
      }
    }
  });

  it('ignores invalid or missing assignments instead of marking a wrong group', () => {
    const svg = MUSCLE_MAP_SVGS.male.front;
    // An unknown group name (e.g. from a damaged custom exercise) marks nothing.
    const invalid = { fullBody: 'primary', unknown: 'secondary' } as unknown as MuscleHighlight;
    expect(highlightSvg(svg, invalid)).toBe(svg);
    // Only levels the map knows; a missing group stays neutral.
    expect(regionLevel('pectoralis-major', {})).toBeNull();
    expect(regionLevel('pectoralis-major', { chest: 'secondary' })).toBe('secondary');
    expect(regionLevel('not-a-muscle', { chest: 'primary' })).toBeNull();
    // A region the app does not know is never marked, even if the drawing had one.
    const foreign = '<path data-region="mystery" data-side="left" d="M0 0"/>';
    expect(highlightSvg(foreign, { chest: 'primary' })).toBe(foreign);
  });

  it('shows at least one primary region for every library exercise on both bodies', () => {
    for (const exercise of EXERCISE_CATALOG) {
      const highlight = muscleHighlight({
        primaryMuscles: exercise.primary,
        secondaryMuscles: exercise.secondary,
      });
      const primary = Object.entries(highlight)
        .filter(([, level]) => level === 'primary')
        .map(([group]) => group as FigureMuscle);
      expect(primary.length, exercise.id).toBeGreaterThan(0);
      for (const variant of MUSCLE_MAP_VARIANTS) {
        const levels = MUSCLE_MAP_VIEWS.flatMap((view) => [
          ...marked(highlightSvg(MUSCLE_MAP_SVGS[variant][view], highlight)).values(),
        ]);
        expect(levels, `${exercise.id} (${variant})`).toContain('primary');
      }
    }
  });
});

describe('bundled drawings', () => {
  it('are self-contained: no scripts, links, external references or embedded images', () => {
    for (const variant of MUSCLE_MAP_VARIANTS) {
      for (const view of MUSCLE_MAP_VIEWS) {
        const svg = MUSCLE_MAP_SVGS[variant][view];
        expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 160 420"/);
        expect(svg).toContain(`data-variant="${variant}" data-view="${view}"`);
        // Decorative: the app names the map as a whole (front and back together).
        expect(svg).toContain('aria-hidden="true" focusable="false"');
        expect(svg).not.toMatch(/<script|<image|<use|<style|href=|url\(|on[a-z]+=|<foreignObject/i);
        // Only the SVG namespace as a URL.
        expect(svg.match(/https?:\/\//g)).toEqual(['http://']);
        // No ids that could collide when several maps are on one screen.
        expect(svg).not.toMatch(/\sid="/);
      }
    }
  });

  it('are exactly what the generator writes (reproducible, own drawing)', async () => {
    const { execFileSync, mkdtempSync, readFileSync, rmSync, tmpdir, join } = await node();
    const env = (globalThis as unknown as { process: { env: Record<string, string> } }).process.env;
    const out = mkdtempSync(join(tmpdir(), 'kalethra-muscle-maps-'));
    try {
      execFileSync('node', ['tools/muscle-maps/build.mjs'], {
        env: { ...env, OUT: out },
        stdio: 'pipe',
      });
      for (const variant of MUSCLE_MAP_VARIANTS) {
        for (const view of MUSCLE_MAP_VIEWS) {
          const name = `${variant}-${view}.svg`;
          expect(readFileSync(join(out, name), 'utf8'), name).toBe(
            readFileSync(join(SVG_DIR, name), 'utf8'),
          );
        }
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
