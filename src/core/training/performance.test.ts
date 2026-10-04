import {
  estimateOneRepMaxKg,
  exerciseProgress,
  strongestSet,
  type PerformanceSession,
} from './metrics';
import type { SetType } from './sets';

type Set = [weightKg: number | null, reps: number | null, completed?: boolean, type?: SetType];

const session = (workoutId: string, localDate: string, sets: Set[]): PerformanceSession => ({
  workoutId,
  localDate,
  sets: sets.map(([weightKg, reps, completed = true, setType = 'working']) => ({
    weightKg,
    reps,
    completed,
    setType,
  })),
});

describe('estimated one-rep max', () => {
  it('uses Epley for 1–12 reps and the load itself for one rep', () => {
    expect(estimateOneRepMaxKg(80, 8)).toBeCloseTo(101.33, 2);
    expect(estimateOneRepMaxKg(100, 1)).toBe(100);
    expect(estimateOneRepMaxKg(60, 13)).toBeNull();
    expect(estimateOneRepMaxKg(0, 5)).toBeNull();
  });
});

describe('strongest set of a workout', () => {
  it('takes the highest estimate, not the heaviest load', () => {
    const set = strongestSet(
      session('w1', '2026-10-01', [
        [100, 2], // ≈ 106.7
        [90, 6], // ≈ 108.0
      ]),
    );
    expect(set).toMatchObject({ weightKg: 90, reps: 6 });
    expect(set?.estimatedOneRepMaxKg).toBeCloseTo(108, 5);
  });

  it('ignores sets that would give a misleading maximum', () => {
    expect(
      strongestSet(
        session('w1', '2026-10-01', [
          [140, 3, false], // not completed
          [140, 3, true, 'warmup'],
          [140, 3, true, 'drop'],
          [null, 10], // no load
          [120, null], // no reps
          [100, 20], // too many reps for an estimate
          [0, 8], // no load
        ]),
      ),
    ).toBeNull();
  });

  it('prefers the heavier set when estimates are equal', () => {
    // 75 × 2 = 80 and 80 × 1 = 80 (Epley): the heavier set wins.
    const set = strongestSet(
      session('w1', '2026-10-01', [
        [75, 2],
        [80, 1],
      ]),
    );
    expect(set).toMatchObject({ weightKg: 80, reps: 1 });
  });
});

describe('exercise progress', () => {
  it('has nothing without rateable workouts', () => {
    expect(exerciseProgress([])).toEqual({
      best: null,
      latest: null,
      latestIsBest: false,
      trend: null,
      sessions: 0,
    });
    expect(exerciseProgress([session('w1', '2026-10-01', [[100, 20]])]).best).toBeNull();
  });

  it('a single workout is the best, but no new best and no trend', () => {
    const progress = exerciseProgress([session('w1', '2026-10-01', [[80, 8]])]);
    expect(progress.best).toMatchObject({ workoutId: 'w1', weightKg: 80, reps: 8 });
    expect(progress.latest).toBe(progress.best);
    expect(progress.latestIsBest).toBe(false);
    expect(progress.trend).toBeNull();
    expect(progress.sessions).toBe(1);
  });

  it('marks a new best and an upward trend', () => {
    const progress = exerciseProgress([
      session('w1', '2026-09-01', [[70, 8]]),
      session('w2', '2026-09-08', [[72.5, 8]]),
      session('w3', '2026-09-15', [[75, 8]]),
      session('w4', '2026-09-22', [[80, 8]]),
    ]);
    expect(progress.best?.workoutId).toBe('w4');
    expect(progress.latestIsBest).toBe(true);
    expect(progress.trend).toBe('up');
    expect(progress.sessions).toBe(4);
  });

  it('keeps the earlier best when the latest only equals it', () => {
    const progress = exerciseProgress([
      session('w1', '2026-09-01', [[80, 8]]),
      session('w2', '2026-09-08', [[80, 8]]),
    ]);
    expect(progress.best?.workoutId).toBe('w1');
    expect(progress.latest?.workoutId).toBe('w2');
    expect(progress.latestIsBest).toBe(false);
    expect(progress.trend).toBe('steady');
  });

  it('compares the latest workout with the mean of the three before it', () => {
    const history = [
      session('w0', '2026-08-25', [[120, 5]]), // older than the comparison window
      session('w1', '2026-09-01', [[80, 8]]),
      session('w2', '2026-09-08', [[80, 8]]),
      session('w3', '2026-09-15', [[80, 8]]),
    ];
    expect(
      exerciseProgress([...history, session('w4', '2026-09-22', [[80, 9]])]).trend, // +3.0 %
    ).toBe('up');
    expect(
      exerciseProgress([...history, session('w4', '2026-09-22', [[80, 7]])]).trend, // −3.0 %
    ).toBe('down');
    expect(
      exerciseProgress([...history, session('w4', '2026-09-22', [[81.25, 8]])]).trend, // +1.6 %
    ).toBe('steady');
  });

  it('skips workouts without a rateable set for latest and trend', () => {
    const progress = exerciseProgress([
      session('w1', '2026-09-01', [[80, 8]]),
      session('w2', '2026-09-08', [[60, 15]]), // only high-rep sets
    ]);
    expect(progress.latest?.workoutId).toBe('w1');
    expect(progress.sessions).toBe(1);
    expect(progress.trend).toBeNull();
  });
});
