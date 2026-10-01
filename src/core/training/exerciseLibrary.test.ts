import {
  EQUIPMENT,
  EXERCISE_TYPES,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  type Equipment,
  type Exercise,
} from './exercise';
import { EXERCISE_CATALOG, exerciseAliases } from './exerciseCatalog';
import {
  MUSCLE_FILTERS,
  exerciseSearchIndex,
  muscleFiltersOf,
  searchExercises,
  type ExerciseFilter,
} from './exerciseSearch';
import { normalizeSearchText } from '@/shared/lib/search';

/** Catalog entries as the database returns them (all active). */
const SYSTEM: Exercise[] = EXERCISE_CATALOG.map((item) => ({
  id: item.id,
  source: 'system',
  profileId: null,
  nameDe: item.nameDe,
  nameEn: item.nameEn,
  exerciseType: item.exerciseType,
  equipment: item.equipment,
  movementPattern: item.movementPattern,
  primaryMuscles: item.primary,
  secondaryMuscles: item.secondary,
  instructionsDe: item.descriptionDe,
  instructionsEn: item.descriptionEn,
  active: true,
}));

const OWN: Exercise = {
  ...SYSTEM[0]!,
  id: 'u1',
  source: 'user',
  profileId: 'p',
  nameDe: 'Meine Spezialpresse',
  nameEn: 'Meine Spezialpresse',
  equipment: 'machine',
  primaryMuscles: ['chest'],
  secondaryMuscles: [],
  instructionsDe: null,
  instructionsEn: null,
};

const de = exerciseSearchIndex([...SYSTEM, OWN], 'de');
const en = exerciseSearchIndex([...SYSTEM, OWN], 'en');
const ids = (index: typeof de, filter: ExerciseFilter) =>
  searchExercises(index, filter).map((exercise) => exercise.id);
const first = (index: typeof de, query: string) => ids(index, { query })[0];

describe('exercise catalog data', () => {
  it('has about 200 exercises', () => {
    expect(EXERCISE_CATALOG.length).toBeGreaterThanOrEqual(190);
    expect(EXERCISE_CATALOG.length).toBeLessThanOrEqual(220);
  });

  it('has unique, permanent-style IDs', () => {
    const all = EXERCISE_CATALOG.map((item) => item.id);
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(id).toMatch(/^sys\.[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('keeps every exercise of the first catalog version', () => {
    const v1 = [
      'sys.bench-press',
      'sys.incline-dumbbell-press',
      'sys.overhead-press',
      'sys.lateral-raise',
      'sys.dip',
      'sys.push-up',
      'sys.triceps-pushdown',
      'sys.pull-up',
      'sys.lat-pulldown',
      'sys.barbell-row',
      'sys.seated-cable-row',
      'sys.biceps-curl',
      'sys.back-squat',
      'sys.leg-press',
      'sys.deadlift',
      'sys.romanian-deadlift',
      'sys.walking-lunge',
      'sys.leg-curl',
      'sys.calf-raise',
      'sys.plank',
      'sys.farmers-carry',
    ];
    const all = new Set<string>(EXERCISE_CATALOG.map((item) => item.id));
    expect(v1.filter((id) => !all.has(id))).toEqual([]);
  });

  it('has German and English names that are unique and fit the name limit', () => {
    for (const key of ['nameDe', 'nameEn'] as const) {
      const names = EXERCISE_CATALOG.map((item) => normalizeSearchText(item[key]));
      const duplicates = names.filter((name, i) => names.indexOf(name) !== i);
      expect(duplicates, key).toEqual([]);
    }
    for (const item of EXERCISE_CATALOG) {
      expect(item.nameDe.trim(), item.id).not.toBe('');
      expect(item.nameEn.trim(), item.id).not.toBe('');
      expect(item.nameDe.length, item.id).toBeLessThanOrEqual(60);
      expect(item.nameEn.length, item.id).toBeLessThanOrEqual(60);
    }
  });

  it('only uses valid types, equipment, patterns and muscles', () => {
    for (const item of EXERCISE_CATALOG) {
      expect(EXERCISE_TYPES, item.id).toContain(item.exerciseType);
      expect(EQUIPMENT, item.id).toContain(item.equipment);
      expect(MOVEMENT_PATTERNS, item.id).toContain(item.movementPattern);
      expect(item.primary.length, item.id).toBeGreaterThan(0);
      for (const muscle of [...item.primary, ...item.secondary]) {
        expect(MUSCLE_GROUPS, item.id).toContain(muscle);
      }
      // A muscle is either primary or secondary, never both.
      expect(
        item.secondary.filter((m) => item.primary.includes(m)),
        item.id,
      ).toEqual([]);
    }
  });

  it('has short descriptions in German and English without promises', () => {
    for (const item of EXERCISE_CATALOG) {
      for (const text of [item.descriptionDe, item.descriptionEn]) {
        expect(text.length, item.id).toBeGreaterThan(30);
        expect(text.length, item.id).toBeLessThanOrEqual(220);
        expect(text, item.id).not.toMatch(/garantiert|guaranteed|beste|best|perfekt|perfect/i);
      }
    }
  });

  it('covers every requested muscle group and equipment', () => {
    for (const filter of MUSCLE_FILTERS) {
      expect(
        SYSTEM.filter((e) => muscleFiltersOf(e).includes(filter)).length,
        filter,
      ).toBeGreaterThan(3);
    }
    const required: Equipment[] = [
      'barbell',
      'dumbbell',
      'cable',
      'machine',
      'smithMachine',
      'bodyweight',
      'band',
      'kettlebell',
      'ezBar',
      'suspension',
    ];
    for (const equipment of required) {
      expect(SYSTEM.filter((e) => e.equipment === equipment).length, equipment).toBeGreaterThan(1);
    }
  });

  it('keeps aliases as search terms that never point to two exercises', () => {
    const owner = new Map<string, string>();
    const names = new Map<string, string>();
    for (const item of EXERCISE_CATALOG) {
      names.set(normalizeSearchText(item.nameDe), item.id);
      names.set(normalizeSearchText(item.nameEn), item.id);
    }
    for (const item of EXERCISE_CATALOG) {
      for (const alias of item.aliases) {
        const key = normalizeSearchText(alias);
        expect(owner.get(key) ?? item.id, `alias "${alias}"`).toBe(item.id);
        owner.set(key, item.id);
        // An alias may repeat the exercise's own name, but never another exercise's name.
        expect(names.get(key) ?? item.id, `alias "${alias}"`).toBe(item.id);
      }
    }
    expect(exerciseAliases('sys.bench-press')).toContain('Bankdrücken');
    expect(exerciseAliases('unknown')).toEqual([]);
  });
});

describe('exercise search', () => {
  it('finds German and English names in either language', () => {
    expect(first(de, 'Langhantel-Bankdrücken')).toBe('sys.bench-press');
    expect(first(de, 'barbell bench press')).toBe('sys.bench-press');
    expect(first(en, 'Barbell Bench Press')).toBe('sys.bench-press');
    expect(first(en, 'kurzhantel bankdrücken')).toBe('sys.dumbbell-bench-press');
  });

  it('finds aliases and former names', () => {
    expect(first(de, 'Bankdrücken')).toBe('sys.bench-press');
    expect(first(de, 'Kniebeugen')).toBe('sys.back-squat');
    expect(first(de, 'RDL')).toBe('sys.romanian-deadlift');
    expect(first(de, 'OHP')).toBe('sys.overhead-press');
    expect(first(de, 'Latziehen')).toBe('sys.lat-pulldown');
    expect(first(en, 'Bauchroller')).toBe('sys.ab-wheel-rollout');
  });

  it('ignores case, umlauts, ß and hyphens and finds partial words', () => {
    expect(first(de, 'LANGHANTEL-BANKDRUECKEN')).toBe('sys.bench-press');
    expect(first(de, 'langhantel bankdrucken')).toBe('sys.bench-press');
    expect(ids(de, { query: 'klimmzu' })).toContain('sys.pull-up');
    expect(ids(de, { query: 'Klimmzuege' })).toContain('sys.pull-up');
    expect(ids(de, { query: 'schräg' })).toEqual(
      expect.arrayContaining(['sys.incline-bench-press', 'sys.incline-dumbbell-press']),
    );
    expect(ids(de, { query: 'seitheb' })).toContain('sys.lateral-raise');
  });

  it('lists each exercise once even when name and aliases match', () => {
    const results = ids(de, { query: 'bank' });
    expect(new Set(results).size).toBe(results.length);
    expect(results.length).toBeGreaterThan(5);
  });

  it('finds user exercises by their name', () => {
    expect(first(de, 'spezialpresse')).toBe('u1');
    expect(first(en, 'Spezial')).toBe('u1');
  });

  it('returns nothing for unknown terms and everything for a blank query', () => {
    expect(ids(de, { query: 'xyzunbekannt' })).toEqual([]);
    expect(ids(de, { query: '   ' })).toHaveLength(SYSTEM.length + 1);
  });
});

describe('exercise filters', () => {
  it('filters by muscle group using the primary muscles', () => {
    const chest = searchExercises(de, { muscle: 'chest' });
    expect(chest.length).toBeGreaterThan(15);
    expect(chest.every((e) => e.primaryMuscles.includes('chest'))).toBe(true);
    expect(chest.map((e) => e.id)).toContain('u1');

    const back = searchExercises(de, { muscle: 'back' }).map((e) => e.id);
    expect(back).toEqual(expect.arrayContaining(['sys.lat-pulldown', 'sys.barbell-row']));

    const legs = searchExercises(de, { muscle: 'legs' }).map((e) => e.id);
    expect(legs).toEqual(
      expect.arrayContaining(['sys.back-squat', 'sys.leg-curl', 'sys.adductor-machine']),
    );
    expect(legs).not.toContain('sys.hip-thrust');
  });

  it('filters by equipment', () => {
    const ez = searchExercises(de, { equipment: 'ezBar' });
    expect(ez.length).toBeGreaterThan(2);
    expect(ez.every((e) => e.equipment === 'ezBar')).toBe(true);
  });

  it('combines muscle, equipment and search', () => {
    const result = searchExercises(de, { muscle: 'chest', equipment: 'dumbbell' });
    expect(result.length).toBeGreaterThan(3);
    expect(
      result.every((e) => e.equipment === 'dumbbell' && e.primaryMuscles.includes('chest')),
    ).toBe(true);
    expect(ids(de, { query: 'schräg', muscle: 'chest', equipment: 'dumbbell' })).toEqual(
      expect.arrayContaining(['sys.incline-dumbbell-press', 'sys.incline-dumbbell-fly']),
    );
    expect(ids(de, { query: 'bankdrücken', equipment: 'cable' })).toEqual([]);
  });

  it('sorts unfiltered results alphabetically by the displayed name', () => {
    const names = searchExercises(de, {}).map((e) => e.nameDe);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'de')));
  });
});
