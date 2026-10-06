import { EXERCISE_CATALOG } from './exerciseCatalog';
import {
  EXERCISE_VISUALS,
  FIGURE_MUSCLES,
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

describe('exercise visuals', () => {
  it('maps permanent catalog IDs to a motion – muscles are not stored twice', () => {
    for (const [id, visual] of Object.entries(EXERCISE_VISUALS)) {
      expect(
        EXERCISE_CATALOG.some((exercise) => exercise.id === id),
        id,
      ).toBe(true);
      expect(Object.keys(visual).sort()).toEqual(['motion', 'side']);
    }
    expect(exerciseVisual('sys.bench-press')).toEqual({ motion: 'benchPress', side: 'front' });
    expect(exerciseVisual('sys.lat-pulldown')).toEqual({ motion: 'latPulldown', side: 'back' });
  });

  it('has no visual for other exercises or unknown IDs', () => {
    expect(exerciseVisual('sys.back-squat')).toBeNull();
    expect(exerciseVisual('nope')).toBeNull();
    expect(exerciseVisual(null)).toBeNull();
  });
});
