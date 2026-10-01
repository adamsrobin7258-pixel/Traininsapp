import { KG_PER_LB } from '@/shared/lib/units';
import { EXERCISE_CATALOG } from './exerciseCatalog';
import {
  exerciseDisplayName,
  matchesExerciseSearch,
  normalizeExerciseName,
  type Exercise,
} from './exercise';
import { estimateOneRepMaxKg, setVolumeKg, summarizeSets, totalVolumeKg } from './metrics';
import { moveItem, nextPlanDay } from './plan';
import {
  EMPTY_SET_VALUES,
  parseLoadInput,
  parseRepsInput,
  parseRpeInput,
  validateSet,
  type WorkoutSet,
} from './sets';
import {
  availableTrainingTypes,
  getTrainingType,
  isKnownTrainingType,
  TRAINING_TYPES,
} from './trainingTypes';
import { durationSeconds, normalizeOptionalText, workoutDisplayTitle } from './workout';

const set = (values: Partial<WorkoutSet>): WorkoutSet => ({
  id: 's',
  workoutExerciseId: 'we',
  position: 0,
  ...EMPTY_SET_VALUES,
  setType: 'working',
  dropOf: null,
  completed: true,
  ...values,
});

describe('training types', () => {
  it('has unique ids and a fallback for unknown ids', () => {
    const ids = TRAINING_TYPES.map((type) => type.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getTrainingType('strength').workflow).toBe('sets');
    expect(getTrainingType('underwater-rugby').id).toBe('other');
    expect(isKnownTrainingType('underwater-rugby')).toBe(false);
  });

  it('prepares endurance and other sports without making them startable yet', () => {
    expect(getTrainingType('running')).toMatchObject({
      workflow: 'endurance',
      supportsRoute: true,
    });
    expect(getTrainingType('hyrox').workflow).toBe('segments');
    expect(getTrainingType('mobility').workflow).toBe('timed');
    expect(availableTrainingTypes().every((type) => type.workflow === 'sets')).toBe(true);
  });
});

describe('set validation', () => {
  it('accepts a complete weighted set with and without RPE', () => {
    expect(validateSet({ ...EMPTY_SET_VALUES, weightKg: 80, reps: 8 }, 'weighted')).toEqual([]);
    expect(
      validateSet({ ...EMPTY_SET_VALUES, weightKg: 80, reps: 8, rpe: 8.5 }, 'weighted'),
    ).toEqual([]);
  });

  it('requires the fields of the exercise type', () => {
    expect(validateSet({ ...EMPTY_SET_VALUES, reps: 8 }, 'weighted')).toEqual([
      { field: 'weightKg', problem: 'required' },
    ]);
    expect(validateSet({ ...EMPTY_SET_VALUES, reps: 10 }, 'bodyweight')).toEqual([]);
    expect(validateSet({ ...EMPTY_SET_VALUES, durationS: 60 }, 'timed')).toEqual([]);
    expect(validateSet(EMPTY_SET_VALUES, 'distance')).toEqual([
      { field: 'distanceM', problem: 'required' },
    ]);
    expect(validateSet({ ...EMPTY_SET_VALUES, distanceM: 40, reps: 3 }, 'distance')).toContainEqual(
      {
        field: 'reps',
        problem: 'notAllowed',
      },
    );
  });

  it.each([
    [{ reps: 0 }, 'reps', 'range'],
    [{ reps: -3 }, 'reps', 'range'],
    [{ reps: 501 }, 'reps', 'range'],
    [{ reps: 8.5 }, 'reps', 'integer'],
    [{ weightKg: -1 }, 'weightKg', 'range'],
    [{ weightKg: 1000.5 }, 'weightKg', 'range'],
    [{ rpe: 0.5 }, 'rpe', 'range'],
    [{ rpe: 10.5 }, 'rpe', 'range'],
    [{ rpe: 7.3 }, 'rpe', 'step'],
  ] as const)('rejects %j', (override, field, problem) => {
    const values = { ...EMPTY_SET_VALUES, weightKg: 80, reps: 8, ...override };
    expect(validateSet(values, 'weighted')).toContainEqual({ field, problem });
  });

  it('accepts boundary values', () => {
    expect(validateSet({ ...EMPTY_SET_VALUES, weightKg: 0, reps: 1, rpe: 1 }, 'weighted')).toEqual(
      [],
    );
    expect(
      validateSet({ ...EMPTY_SET_VALUES, weightKg: 1000, reps: 500, rpe: 10 }, 'weighted'),
    ).toEqual([]);
  });
});

describe('set input parsing', () => {
  it('parses loads in the user unit and converts once to kg', () => {
    expect(parseLoadInput('82,5', 'kg')).toEqual({ ok: true, value: 82.5 });
    expect(parseLoadInput('1.25', 'kg')).toEqual({ ok: true, value: 1.25 });
    expect(parseLoadInput('225', 'lb')).toEqual({ ok: true, value: 225 * KG_PER_LB });
    expect(parseLoadInput('', 'kg')).toEqual({ ok: true, value: null });
    expect(parseLoadInput('80.125', 'kg')).toEqual({ ok: false, problem: 'precision' });
    expect(parseLoadInput('-5', 'kg')).toEqual({ ok: false, problem: 'invalid' });
  });

  it('allows whole repetitions only', () => {
    expect(parseRepsInput('8')).toEqual({ ok: true, value: 8 });
    expect(parseRepsInput('8,5')).toEqual({ ok: false, problem: 'precision' });
    expect(parseRpeInput('8,5')).toEqual({ ok: true, value: 8.5 });
  });
});

describe('metrics', () => {
  it('computes volume from completed sets only', () => {
    expect(setVolumeKg(set({ weightKg: 80, reps: 8 }))).toBe(640);
    expect(setVolumeKg(set({ weightKg: 80, reps: 8, completed: false }))).toBe(0);
    expect(setVolumeKg(set({ reps: 12 }))).toBe(0);
    expect(totalVolumeKg([set({ weightKg: 80, reps: 8 }), set({ weightKg: 80, reps: 7 })])).toBe(
      1200,
    );
  });

  it('estimates 1RM only where the formula is reliable', () => {
    expect(estimateOneRepMaxKg(100, 1)).toBe(100);
    expect(estimateOneRepMaxKg(100, 10)).toBeCloseTo(133.33, 2);
    expect(estimateOneRepMaxKg(100, 20)).toBeNull();
    expect(estimateOneRepMaxKg(0, 5)).toBeNull();
  });

  it('summarizes an exercise for later records', () => {
    const summary = summarizeSets(
      [
        set({ weightKg: 80, reps: 8 }),
        set({ weightKg: 85, reps: 5 }),
        set({ weightKg: 90, reps: 3, completed: false }),
      ],
      'weighted',
    );
    expect(summary).toMatchObject({
      heaviestKg: 85,
      mostReps: 8,
      volumeKg: 1065,
      completedSets: 2,
    });
    // Epley: 80 × (1 + 8/30) = 101.3 beats 85 × (1 + 5/30) = 99.2
    expect(summary.bestEstimatedOneRepMaxKg).toBeCloseTo(101.33, 2);
  });
});

describe('plans', () => {
  const plan = {
    id: 'p',
    name: 'PPL',
    days: [
      { id: 'legs', planId: 'p', name: 'Legs', position: 2, exercises: [] },
      { id: 'push', planId: 'p', name: 'Push', position: 0, exercises: [] },
      { id: 'pull', planId: 'p', name: 'Pull', position: 1, exercises: [] },
    ],
  };

  it('suggests the next day and wraps around', () => {
    expect(nextPlanDay(plan, null)?.dayName).toBe('Push');
    expect(nextPlanDay(plan, 'push')?.dayName).toBe('Pull');
    expect(nextPlanDay(plan, 'legs')?.dayName).toBe('Push');
    expect(nextPlanDay(plan, 'deleted-day')?.dayName).toBe('Push');
    expect(nextPlanDay({ ...plan, days: [] }, null)).toBeNull();
  });

  it('moves items within bounds', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
  });
});

describe('exercises', () => {
  const bench = EXERCISE_CATALOG.find((e) => e.id === 'sys.bench-press')!;
  const exercise = { ...bench, nameDe: bench.nameDe, nameEn: bench.nameEn } as unknown as Exercise;

  it('shows translated names and searches both languages without accents', () => {
    expect(exerciseDisplayName(exercise, 'de')).toBe('Langhantel-Bankdrücken');
    expect(exerciseDisplayName(exercise, 'en')).toBe('Barbell Bench Press');
    expect(matchesExerciseSearch(exercise, 'bankdruck')).toBe(true);
    expect(matchesExerciseSearch(exercise, 'BENCH')).toBe(true);
    expect(matchesExerciseSearch(exercise, 'squat')).toBe(false);
  });

  it('normalizes custom names', () => {
    expect(normalizeExerciseName('  Landmine   Press ')).toEqual({
      ok: true,
      name: 'Landmine Press',
    });
    expect(normalizeExerciseName('   ')).toEqual({ ok: false, error: 'empty' });
    expect(normalizeExerciseName('x'.repeat(61))).toEqual({ ok: false, error: 'tooLong' });
  });

  it('has a consistent catalog', () => {
    const ids = EXERCISE_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(EXERCISE_CATALOG.every((e) => e.nameDe && e.nameEn && e.primary.length > 0)).toBe(true);
  });
});

describe('workouts', () => {
  it('computes durations and display titles', () => {
    expect(durationSeconds('2026-10-03T10:00:00.000Z', '2026-10-03T10:52:30.000Z')).toBe(3150);
    expect(durationSeconds('2026-10-03T10:00:00.000Z', '2026-10-03T09:00:00.000Z')).toBe(0);
    expect(workoutDisplayTitle({ title: null, planDayName: 'Push A' })).toBe('Push A');
    expect(workoutDisplayTitle({ title: 'Heavy day', planDayName: 'Push A' })).toBe('Heavy day');
    expect(normalizeOptionalText('   ', 10)).toBeNull();
  });
});
