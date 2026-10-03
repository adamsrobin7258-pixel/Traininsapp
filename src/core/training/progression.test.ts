import {
  LOAD_STEP,
  PROGRESSION_MAX_SESSIONS,
  PROGRESSION_MAX_TARGET_REPS,
  PROGRESSION_RULES,
  raisedLoadKg,
  repsAtLoad,
  successfulLoadKg,
  suggestProgression,
} from './progression';
import { allowedSetTypes, changeSetType, type SetType, type WorkoutSet } from './sets';
import { toKg } from '@/shared/lib/units';

let id = 0;
function set(
  weightKg: number | null,
  reps: number | null,
  setType: SetType = 'working',
  extra: Partial<WorkoutSet> = {},
): WorkoutSet {
  id += 1;
  return {
    id: `s${id}`,
    workoutExerciseId: 'we',
    position: id,
    weightKg,
    reps,
    durationS: null,
    distanceM: null,
    rpe: null,
    setType,
    dropOf: null,
    completed: true,
    ...extra,
  };
}

/** One session: `reps` working sets at `kg`. */
const session = (kg: number, ...reps: number[]) => reps.map((r) => set(kg, r));
/** `count` identical sessions, newest first. */
const repeat = (count: number, make: () => WorkoutSet[]) =>
  Array.from({ length: count }, () => make());

const target = { reps: 8, sets: 3 };

describe('progression thresholds (documented values)', () => {
  it('are central and differ per mode', () => {
    expect(PROGRESSION_RULES).toEqual({
      cautious: { sessions: 4, increasePercent: 2.5 },
      normal: { sessions: 3, increasePercent: 5 },
      progressive: { sessions: 2, increasePercent: 7.5 },
    });
    expect(LOAD_STEP).toEqual({ kg: 1.25, lb: 2.5 });
    expect(PROGRESSION_MAX_TARGET_REPS).toBe(12);
    expect(PROGRESSION_MAX_SESSIONS).toBe(4);
  });

  it('80 kg × 8: cautious 82.5 × 6, normal 83.75 × 6, progressive 86.25 × 5', () => {
    const history = repeat(4, () => session(80, 8, 8, 8));
    expect(suggestProgression(history, target, 'cautious', 'kg')).toEqual({
      fromKg: 80,
      fromReps: 8,
      weightKg: 82.5,
      reps: 6,
      sessions: 4,
    });
    expect(suggestProgression(history, target, 'normal', 'kg')).toMatchObject({
      weightKg: 83.75,
      reps: 6,
      sessions: 3,
    });
    expect(suggestProgression(history, target, 'progressive', 'kg')).toMatchObject({
      weightKg: 86.25,
      reps: 5,
      sessions: 2,
    });
  });

  it('off: never a suggestion', () => {
    const history = repeat(10, () => session(80, 8, 8, 8));
    expect(suggestProgression(history, target, 'off', 'kg')).toBeNull();
  });
});

describe('when a suggestion appears', () => {
  it('needs enough successful sessions in a row: 1, 2, 3 sessions (normal)', () => {
    const one = repeat(1, () => session(80, 8, 8, 8));
    const two = repeat(2, () => session(80, 8, 8, 8));
    const three = repeat(3, () => session(80, 8, 8, 8));
    expect(suggestProgression(one, target, 'normal', 'kg')).toBeNull();
    expect(suggestProgression(two, target, 'normal', 'kg')).toBeNull();
    expect(suggestProgression(three, target, 'normal', 'kg')).not.toBeNull();
    // Progressive is satisfied with two, cautious still needs four.
    expect(suggestProgression(two, target, 'progressive', 'kg')).not.toBeNull();
    expect(suggestProgression(three, target, 'cautious', 'kg')).toBeNull();
  });

  it('a weaker session in between resets it: 80 × 8, 8, 8 / 80 × 8, 5, 4 / …', () => {
    const history = [session(80, 8, 8, 8), session(80, 8, 5, 4), session(80, 8, 8, 8)];
    expect(suggestProgression(history, target, 'normal', 'kg')).toBeNull();
    // Even the newest session alone being weaker stops it.
    const newestWeaker = [session(80, 8, 5, 4), ...repeat(3, () => session(80, 8, 8, 8))];
    expect(suggestProgression(newestWeaker, target, 'normal', 'kg')).toBeNull();
  });

  it('more reps than the target count as success; the target (not the extra reps) is used', () => {
    const history = repeat(3, () => session(80, 10, 9, 8));
    expect(suggestProgression(history, target, 'normal', 'kg')).toMatchObject({
      fromReps: 8,
      weightKg: 83.75,
      reps: 6,
    });
  });

  it('different loads across the sessions: no suggestion', () => {
    const history = [session(80, 8, 8, 8), session(77.5, 8, 8, 8), session(80, 8, 8, 8)];
    expect(suggestProgression(history, target, 'normal', 'kg')).toBeNull();
  });

  it('mixed loads within a session or too few working sets: not successful', () => {
    expect(successfulLoadKg([set(80, 8), set(77.5, 8), set(80, 8)], target)).toBeNull();
    expect(successfulLoadKg(session(80, 8, 8), target)).toBeNull();
    expect(successfulLoadKg(session(80, 8, 8), { reps: 8, sets: null })).toBe(80);
    expect(successfulLoadKg([], target)).toBeNull();
  });

  it('warm-ups and drops are ignored; open sets do not count', () => {
    const sets = [
      set(40, 12, 'warmup'),
      ...session(80, 8, 8, 8),
      set(60, 4, 'drop', { dropOf: 's2' }),
      set(80, 2, 'working', { completed: false }),
    ];
    expect(successfulLoadKg(sets, target)).toBe(80);
  });

  it('after the increase the next suggestion waits until the target is reached again', () => {
    // 82.5 kg × 6, 6, 6 three times: below the target of 8 → no further increase.
    const history = repeat(3, () => session(82.5, 6, 6, 6));
    expect(suggestProgression(history, target, 'normal', 'kg')).toBeNull();
    // Once 82.5 × 8 is held, the next step follows.
    const reached = repeat(3, () => session(82.5, 8, 8, 8));
    expect(suggestProgression(reached, target, 'normal', 'kg')).toMatchObject({ fromKg: 82.5 });
  });

  it('no target, a target above 12 reps or no load: no suggestion', () => {
    const history = repeat(4, () => session(80, 15, 15, 15));
    expect(suggestProgression(history, null, 'normal', 'kg')).toBeNull();
    expect(suggestProgression(history, { reps: 15, sets: 3 }, 'normal', 'kg')).toBeNull();
    const unloaded = repeat(4, () => session(0, 8, 8, 8));
    expect(suggestProgression(unloaded, target, 'normal', 'kg')).toBeNull();
  });
});

describe('higher load → fewer reps', () => {
  it('rounds the increase to the load step, at least one step', () => {
    expect(raisedLoadKg(80, 2.5, 'kg')).toBe(82.5); // 2 kg → 2.5
    expect(raisedLoadKg(80, 5, 'kg')).toBe(83.75); // 4 kg → 3.75
    expect(raisedLoadKg(80, 7.5, 'kg')).toBe(86.25); // 6 kg → 6.25
    expect(raisedLoadKg(10, 2.5, 'kg')).toBe(11.25); // 0.25 kg → one step
    expect(raisedLoadKg(200, 5, 'kg')).toBe(210);
  });

  it('pounds use 2.5 lb steps', () => {
    // 175 lb × 5 % = 8.75 lb → 3.5 steps → 4 steps = 10 lb → 185 lb.
    expect(raisedLoadKg(toKg(175, 'lb'), 5, 'lb')).toBeCloseTo(toKg(185, 'lb'), 9);
    expect(raisedLoadKg(toKg(20, 'lb'), 2.5, 'lb')).toBeCloseTo(toKg(22.5, 'lb'), 9);
  });

  it('keeps the estimated maximum (Epley), rounded down, always fewer reps than before', () => {
    expect(repsAtLoad(80, 8, 82.5)).toBe(6);
    expect(repsAtLoad(80, 8, 86.25)).toBe(5);
    expect(repsAtLoad(100, 5, 102.5)).toBe(4);
    expect(repsAtLoad(100, 12, 101.25)).toBe(11);
    // A higher load never keeps the same reps; below one rep there is no suggestion.
    expect(repsAtLoad(100, 1, 110)).toBeNull();
    expect(repsAtLoad(100, 8, 100)).toBeNull();
  });

  it('the suggestion always has fewer reps than the target at a higher load', () => {
    for (const mode of ['cautious', 'normal', 'progressive'] as const) {
      for (const [kg, reps] of [
        [20, 12],
        [60, 10],
        [100, 5],
        [140, 3],
      ] as const) {
        const history = repeat(4, () => session(kg, reps, reps, reps));
        const result = suggestProgression(history, { reps, sets: 3 }, mode, 'kg');
        if (result) {
          expect(result.weightKg).toBeGreaterThan(kg);
          expect(result.reps).toBeLessThan(reps);
        }
      }
    }
  });

  it('is deterministic: the same history gives the same suggestion', () => {
    const history = repeat(3, () => session(80, 8, 8, 8));
    const results = Array.from({ length: 5 }, () =>
      suggestProgression(history, target, 'normal', 'kg'),
    );
    expect(new Set(results.map((r) => JSON.stringify(r))).size).toBe(1);
  });
});

describe('changing a set type', () => {
  const structure = () => {
    const w1 = set(40, 10, 'warmup', { position: 0, id: 'w1' });
    const s1 = set(80, 8, 'working', { position: 1, id: 's1' });
    const d1 = set(60, 6, 'drop', { position: 2, id: 'd1', dropOf: 's1' });
    const d2 = set(50, 6, 'drop', { position: 3, id: 'd2', dropOf: 's1' });
    const s2 = set(80, 8, 'working', { position: 4, id: 's2' });
    return [w1, s1, d1, d2, s2];
  };
  const shape = (result: ReturnType<typeof changeSetType>) =>
    result?.map((s) => `${s.id}:${s.setType}${s.dropOf ? `>${s.dropOf}` : ''}@${s.position}`);

  it('offers only valid types', () => {
    const sets = structure();
    expect(allowedSetTypes(sets, 'w1')).toEqual(['working']);
    expect(allowedSetTypes(sets, 's1')).toEqual([]); // has drops, nothing before it
    expect(allowedSetTypes(sets, 's2')).toEqual(['warmup', 'drop']);
    expect(allowedSetTypes(sets, 'd1')).toEqual(['working', 'warmup']);
  });

  it('warm-up → working set: becomes the first working set', () => {
    expect(shape(changeSetType(structure(), 'w1', 'working'))).toEqual([
      'w1:working@0',
      's1:working@1',
      'd1:drop>s1@2',
      'd2:drop>s1@3',
      's2:working@4',
    ]);
  });

  it('working set → drop of the set before; → warm-up moves to the warm-ups', () => {
    expect(shape(changeSetType(structure(), 's2', 'drop'))).toEqual([
      'w1:warmup@0',
      's1:working@1',
      'd1:drop>s1@2',
      'd2:drop>s1@3',
      's2:drop>s1@4',
    ]);
    expect(shape(changeSetType(structure(), 's2', 'warmup'))).toEqual([
      'w1:warmup@0',
      's2:warmup@1',
      's1:working@2',
      'd1:drop>s1@3',
      'd2:drop>s1@4',
    ]);
  });

  it('drop → working set: the later drops of its chain continue it', () => {
    expect(shape(changeSetType(structure(), 'd1', 'working'))).toEqual([
      'w1:warmup@0',
      's1:working@1',
      'd1:working@2',
      'd2:drop>d1@3',
      's2:working@4',
    ]);
  });

  it('rejects invalid changes and keeps values', () => {
    expect(changeSetType(structure(), 's1', 'warmup')).toBeNull();
    expect(changeSetType(structure(), 'w1', 'drop')).toBeNull();
    expect(changeSetType(structure(), 's2', 'working')).toBeNull();
    expect(changeSetType(structure(), 'missing', 'working')).toBeNull();
  });
});
