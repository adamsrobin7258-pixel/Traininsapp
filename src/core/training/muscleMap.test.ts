import { EXERCISE_CATALOG } from './exerciseCatalog';
import {
  EXERCISE_VISUALS,
  FIGURE_MOVEMENTS,
  FIGURE_MUSCLES,
  REST_VISUAL,
  movementForPattern,
  aggregateMuscleHighlight,
  doneExercises,
  exerciseVisual,
  highlightGroups,
  muscleHighlight,
} from './muscleMap';

const catalog = (id: string) => {
  const entry = EXERCISE_CATALOG.find((exercise) => exercise.id === id);
  if (!entry) throw new Error(id);
  return { id, primaryMuscles: entry.primary, secondaryMuscles: entry.secondary };
};

describe('muscle highlight from the exercise data', () => {
  it('takes primary and secondary muscles straight from the catalog', () => {
    // Bench press: chest primary; triceps and shoulders secondary (catalog data).
    expect(muscleHighlight(catalog('sys.bench-press'))).toEqual({
      chest: 'primary',
      triceps: 'secondary',
      shoulders: 'secondary',
    });
    // Lat pulldown: lats primary; biceps and upper back secondary.
    expect(muscleHighlight(catalog('sys.lat-pulldown'))).toEqual({
      lats: 'primary',
      biceps: 'secondary',
      back: 'secondary',
    });
  });

  it('leaves every other group neutral and lists the groups in catalog order', () => {
    const groups = highlightGroups(muscleHighlight(catalog('sys.bench-press')));
    expect(groups).toEqual({ primary: ['chest'], secondary: ['shoulders', 'triceps'] });
    expect(FIGURE_MUSCLES).not.toContain('fullBody');
    expect(FIGURE_MUSCLES).toHaveLength(13);
  });

  it('reads "fullBody" as every region, and primary wins over secondary', () => {
    expect(muscleHighlight({ primaryMuscles: ['fullBody'], secondaryMuscles: [] })).toEqual(
      Object.fromEntries(FIGURE_MUSCLES.map((group) => [group, 'primary'])),
    );
    expect(
      muscleHighlight({ primaryMuscles: ['chest'], secondaryMuscles: ['chest', 'fullBody'] }),
    ).toMatchObject({ chest: 'primary', lats: 'secondary', calves: 'secondary' });
  });

  it('aggregates several exercises as a simple union – no weighting', () => {
    const highlight = aggregateMuscleHighlight([
      catalog('sys.bench-press'),
      catalog('sys.lat-pulldown'),
    ]);
    expect(highlightGroups(highlight)).toEqual({
      primary: ['chest', 'lats'],
      secondary: ['back', 'shoulders', 'biceps', 'triceps'],
    });
    // Secondary in one, primary in another → primary.
    expect(
      aggregateMuscleHighlight([
        { primaryMuscles: ['triceps'], secondaryMuscles: [] },
        catalog('sys.bench-press'),
      ]).triceps,
    ).toBe('primary');
    expect(aggregateMuscleHighlight([])).toEqual({});
  });

  it('uses only exercises of a workout that were actually done', () => {
    const lookup = (id: string) =>
      EXERCISE_CATALOG.some((exercise) => exercise.id === id) ? catalog(id) : undefined;
    const done = doneExercises(
      {
        exercises: [
          { exerciseId: 'sys.bench-press', sets: [{ completed: true }, { completed: false }] },
          { exerciseId: 'sys.lat-pulldown', sets: [{ completed: false }] },
          { exerciseId: null, sets: [{ completed: true }] },
          { exerciseId: 'user.gone', sets: [{ completed: true }] },
        ],
      },
      lookup,
    );
    expect(done.map((exercise) => exercise.id)).toEqual(['sys.bench-press']);
  });
});

describe('exercise visuals: exercise → movement type → clip', () => {
  const exercise = (id: string) => {
    const entry = EXERCISE_CATALOG.find((e) => e.id === id);
    if (!entry) throw new Error(id);
    return { id, movementPattern: entry.movementPattern };
  };

  it('takes the movement type from the library pattern – muscles are not stored here', () => {
    for (const [id, entry] of Object.entries(EXERCISE_VISUALS)) {
      const catalog = EXERCISE_CATALOG.find((e) => e.id === id);
      expect(catalog, id).toBeDefined();
      expect(Object.keys(entry)).not.toContain('muscles');
      // An explicit movement only where the pattern cannot decide (isolation, other).
      if (entry.movement) expect(['isolation', 'other']).toContain(catalog?.movementPattern);
    }
    expect(exerciseVisual(exercise('sys.bench-press'))).toEqual({
      movement: 'horizontalPush',
      clip: 'horizontalPush_bench',
      side: 'front',
    });
    expect(exerciseVisual(exercise('sys.lat-pulldown'))).toEqual({
      movement: 'verticalPull',
      clip: 'verticalPull_cable',
      side: 'back',
    });
  });

  it('maps every library pattern to a movement type, isolation needs the exercise', () => {
    expect(movementForPattern('horizontalPush')).toBe('horizontalPush');
    expect(movementForPattern('verticalPull')).toBe('verticalPull');
    expect(movementForPattern('squat')).toBe('squat');
    expect(movementForPattern('hinge')).toBe('hinge');
    expect(movementForPattern('carry')).toBe('carry');
    expect(movementForPattern('isolation')).toBeNull();
    expect(movementForPattern('other')).toBeNull();
    for (const movement of ['curl', 'extension', 'raise', 'rest'] as const) {
      expect(FIGURE_MOVEMENTS).toContain(movement);
    }
  });

  it('has no visual for other exercises or unknown IDs', () => {
    expect(exerciseVisual(exercise('sys.back-squat'))).toBeNull();
    expect(exerciseVisual({ id: 'nope', movementPattern: 'squat' })).toBeNull();
    expect(REST_VISUAL).toEqual({ movement: 'rest', clip: 'rest', side: 'front' });
  });
});
