import type { SetType, WorkoutExerciseWithSets, WorkoutSet } from '@/core/training';
import { nextOpenSet, nextPosition, positionAfter, setEntries } from './focus';

let position = 0;

function set(
  id: string,
  setType: SetType = 'working',
  completed = false,
  dropOf: string | null = null,
): WorkoutSet {
  position += 1;
  return {
    id,
    workoutExerciseId: 'x',
    position,
    weightKg: 80,
    reps: 8,
    durationS: null,
    distanceM: null,
    rpe: null,
    setType,
    dropOf,
    completed,
  };
}

function exercise(id: string, sets: WorkoutSet[]): WorkoutExerciseWithSets {
  return {
    id,
    workoutId: 'w',
    exerciseId: `sys.${id}`,
    position: 0,
    nameDe: id,
    nameEn: id,
    exerciseType: 'weighted',
    sets,
  };
}

describe('set order and numbering', () => {
  it('warm-ups, then each working set with its drops – the order of the full list', () => {
    // Stored out of order on purpose: positions decide, like groupSets.
    const w1 = set('w1');
    const d1 = set('d1', 'drop', false, 'w1');
    const w2 = set('w2');
    const a1 = { ...set('a1', 'warmup'), position: -1 };
    const entries = setEntries([w2, d1, a1, w1]);
    expect(entries.map((e) => [e.set.id, e.kind, e.number, e.drop])).toEqual([
      ['a1', 'warmup', 1, 0],
      ['w1', 'working', 1, 0],
      ['d1', 'drop', 1, 1],
      ['w2', 'working', 2, 0],
    ]);
  });
});

describe('the next open set of an exercise', () => {
  it('takes warm-ups first, then working sets, then their drops', () => {
    const sets = [set('a1', 'warmup'), set('w1'), set('d1', 'drop', false, 'w1'), set('w2')];
    const bench = exercise('bench', sets);
    expect(nextOpenSet(bench)?.id).toBe('a1');
    expect(nextOpenSet(bench, new Set(['a1']))?.id).toBe('w1');
    expect(nextOpenSet(bench, new Set(['a1', 'w1']))?.id).toBe('d1');
    expect(nextOpenSet(bench, new Set(['a1', 'w1', 'd1']))?.id).toBe('w2');
  });

  it('skips completed sets; with several open sets the first one in order', () => {
    const bench = exercise('bench', [set('w1', 'working', true), set('w2'), set('w3')]);
    expect(nextOpenSet(bench)?.id).toBe('w2');
  });

  it('a reopened set is open again – also before later open sets', () => {
    const bench = exercise('bench', [set('w1'), set('w2', 'working', true), set('w3')]);
    expect(nextOpenSet(bench)?.id).toBe('w1');
  });

  it('nothing for an exercise without sets or with every set completed', () => {
    expect(nextOpenSet(exercise('empty', []))).toBeNull();
    expect(nextOpenSet(exercise('done', [set('w1', 'working', true)]))).toBeNull();
  });
});

describe('the position in the workout', () => {
  const workout = () => [
    exercise('bench', [set('b1', 'working', true), set('b2')]),
    exercise('empty', []),
    exercise('done', [set('d1', 'working', true)]),
    exercise('row', [set('r1'), set('r2')]),
  ];

  it('starts at the first exercise with an open set', () => {
    expect(nextPosition(workout())).toEqual({ exerciseId: 'bench', setId: 'b2' });
    expect(nextPosition(workout().slice(1))).toEqual({ exerciseId: 'row', setId: 'r1' });
  });

  it('stays on the exercise while it has open sets', () => {
    const exercises = [exercise('bench', [set('b1'), set('b2')])];
    expect(positionAfter(exercises, 'bench', 'b1')).toEqual({ exerciseId: 'bench', setId: 'b2' });
  });

  it('takes the open set after the completed one, then a skipped earlier one', () => {
    // The warm-up was skipped and set 2 chosen: its drop follows, then the skipped sets.
    const exercises = [
      exercise('squat', [
        set('a1', 'warmup'),
        set('s1'),
        set('s2'),
        set('d1', 'drop', false, 's2'),
      ]),
      exercise('row', [set('r1')]),
    ];
    expect(positionAfter(exercises, 'squat', 's2')).toEqual({ exerciseId: 'squat', setId: 'd1' });
    expect(positionAfter(exercises, 'squat', 'd1', new Set(['s2']))).toEqual({
      exerciseId: 'squat',
      setId: 'a1',
    });
    expect(positionAfter(exercises, 'squat', 'a1', new Set(['s1', 's2', 'd1']))).toEqual({
      exerciseId: 'row',
      setId: 'r1',
    });
  });

  it('after the last open set goes to the next exercise with an open set', () => {
    // Exercises without sets and completed exercises are skipped.
    expect(positionAfter(workout(), 'bench', 'b2')).toEqual({ exerciseId: 'row', setId: 'r1' });
  });

  it('then continues with earlier exercises that still have open sets', () => {
    expect(positionAfter(workout(), 'row', 'r1')).toEqual({ exerciseId: 'row', setId: 'r2' });
    const exercises = workout();
    expect(positionAfter(exercises, 'done', 'd1')).toEqual({ exerciseId: 'row', setId: 'r1' });
    const rowDone = [
      exercise('bench', [set('b1')]),
      exercise('row', [set('r1', 'working', true), set('r2')]),
    ];
    expect(positionAfter(rowDone, 'row', 'r2')).toEqual({ exerciseId: 'bench', setId: 'b1' });
  });

  it('nothing is open any more in the whole workout', () => {
    const exercises = [
      exercise('bench', [set('b1', 'working', true), set('b2')]),
      exercise('empty', []),
    ];
    expect(positionAfter(exercises, 'bench', 'b2')).toBeNull();
    expect(nextPosition([])).toBeNull();
    expect(nextPosition([exercise('empty', [])])).toBeNull();
  });

  it('an unknown exercise searches from the start', () => {
    expect(positionAfter(workout(), 'gone', 'x')).toEqual({ exerciseId: 'bench', setId: 'b2' });
  });
});
