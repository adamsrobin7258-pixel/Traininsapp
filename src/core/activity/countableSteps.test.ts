import type { ExternalWorkout } from '@/core/health';
import { stepDaySpan } from '@/core/health';
import {
  countableActivities,
  countableActivityMinutes,
  countableStepsPerDay,
  mergeIntervals,
  type CountableActivity,
  type StepRecord,
} from './combined';
import type { ManualActivity } from './manualActivity';

const iso = (hour: number, minute = 0) => new Date(2026, 9, 2, hour, minute).toISOString();
const span = (from: [number, number], to: [number, number]) => ({
  startedAt: iso(...from),
  endedAt: iso(...to),
});
const activity = (from: [number, number], to: [number, number]): CountableActivity => ({
  key: `hc:${String(from)}`,
  localDate: '2026-10-02',
  durationS: 0,
  kcal: null,
  span: span(from, to),
});
const record = (from: [number, number], to: [number, number], steps: number): StepRecord => ({
  localDate: '2026-10-02',
  steps,
  ...span(from, to),
});
const dayRecord = (steps: number): StepRecord => {
  const whole = stepDaySpan('2026-10-02');
  if (!whole) throw new Error('day expected');
  return { localDate: '2026-10-02', steps, ...whole };
};

function imported(id: string, from: [number, number], to: [number, number]): ExternalWorkout {
  return {
    id,
    profileId: 'p',
    platform: 'healthConnect',
    externalId: id,
    activityType: 'walking',
    category: 'endurance',
    ...span(from, to),
    localDate: '2026-10-02',
    durationS: (Date.parse(iso(...to)) - Date.parse(iso(...from))) / 1000,
    activeKcal: null,
    distanceM: null,
    steps: null,
    source: null,
  };
}

function manual(startedAt: string | null, minutes: number): ManualActivity {
  return {
    id: 'm',
    profileId: 'p',
    sportId: 'yoga',
    localDate: '2026-10-02',
    startedAt,
    durationS: minutes * 60,
    distanceM: null,
    intensity: null,
    variant: null,
    weightKg: null,
    met: 2.5,
    metRef: '',
    metBasis: 'general',
    calcMethod: 'met',
    calculatedKcal: null,
    kcal: null,
    kcalOverridden: false,
    createdAt: '',
    updatedAt: '',
  };
}

describe('merged activity intervals', () => {
  it('C: overlapping activities become one interval – no time excluded twice', () => {
    const merged = mergeIntervals([span([10, 0], [10, 45]), span([10, 30], [11, 15])]);
    expect(merged).toEqual([{ start: Date.parse(iso(10)), end: Date.parse(iso(11, 15)) }]);
    // 75 minutes, not 45 + 45 = 90.
    expect(((merged[0]?.end ?? 0) - (merged[0]?.start ?? 0)) / 60_000).toBe(75);
  });

  it('keeps separate activities apart and drops spans without a valid time', () => {
    expect(
      mergeIntervals([
        span([18, 0], [19, 0]),
        span([7, 0], [7, 30]),
        { startedAt: 'unbekannt', endedAt: iso(9) },
      ]),
    ).toHaveLength(2);
  });
});

describe('steps outside tracked activities', () => {
  it('A: steps without any activity count in full', () => {
    expect(countableStepsPerDay([dayRecord(8000)], [])).toEqual([
      { localDate: '2026-10-02', steps: 8000, excludedSteps: 0 },
    ]);
  });

  it('B: step records within a tracked walk do not count again (10.000 − 3.000 = 7.000)', () => {
    const walk = activity([10, 0], [11, 0]);
    const records = [
      record([8, 0], [10, 0], 4000),
      record([10, 0], [10, 30], 1500),
      record([10, 30], [11, 0], 1500),
      record([11, 0], [20, 0], 3000),
    ];
    expect(countableStepsPerDay(records, [walk])).toEqual([
      { localDate: '2026-10-02', steps: 7000, excludedSteps: 3000 },
    ]);
  });

  it('C: records inside merged overlapping activities are excluded once', () => {
    const a = activity([10, 0], [10, 45]);
    const b = activity([10, 30], [11, 15]);
    // 10:40–11:00 lies in neither activity alone, but within the merged 10:00–11:15.
    const records = [record([10, 0], [10, 40], 2000), record([10, 40], [11, 0], 1000)];
    expect(countableStepsPerDay(records, [a, b])[0]).toMatchObject({
      steps: 0,
      excludedSteps: 3000,
    });
  });

  it('a record that only partly overlaps stays – how its steps spread is unknown', () => {
    const walk = activity([10, 0], [11, 0]);
    expect(countableStepsPerDay([record([9, 30], [10, 30], 2000)], [walk])[0]).toMatchObject({
      steps: 2000,
      excludedSteps: 0,
    });
  });

  it('a daily total (today’s Health Connect data) is never cut by an activity – no whole-day deduction', () => {
    const walk = activity([10, 0], [11, 0]);
    expect(countableStepsPerDay([dayRecord(10_000)], [walk])[0]).toMatchObject({
      steps: 10_000,
      excludedSteps: 0,
    });
  });

  it('D: an activity without a usable time excludes nothing', () => {
    const yoga = manual(null, 60);
    const activities = countableActivities([], [yoga], []);
    expect(activities).toEqual([
      { key: 'manual:m', localDate: '2026-10-02', durationS: 3600, kcal: null, span: null },
    ]);
    expect(countableStepsPerDay([record([10, 0], [11, 0], 3000)], activities)[0]).toMatchObject({
      steps: 3000,
      excludedSteps: 0,
    });
    // It still counts as an activity (existing rule).
    expect(countableActivityMinutes([], [yoga], [])).toEqual([
      { localDate: '2026-10-02', minutes: 60 },
    ]);
  });

  it('E: without step data there is no day at all – never 0 steps', () => {
    expect(countableStepsPerDay([], [activity([10, 0], [11, 0])])).toEqual([]);
  });

  it('J: a Health Connect session that is a Kalethra workout is no countable activity', () => {
    const watch = imported('watch', [18, 0], [19, 0]);
    const own = [span([18, 0], [19, 0])];
    expect(countableActivities([watch], [], own)).toEqual([]);
    expect(countableActivityMinutes([watch], [], own)).toEqual([]);
    // Without the workout it is an activity, and its steps would count through it.
    expect(countableActivities([watch], [], [])).toHaveLength(1);
  });

  it('a manual duplicate of an import counts once; the import provides the interval', () => {
    const walk = imported('walk', [10, 0], [11, 0]);
    const twin = { ...manual(iso(10, 5), 55), sportId: 'walk' };
    const activities = countableActivities([walk], [twin], []);
    expect(activities).toHaveLength(1);
    expect(countableActivityMinutes([walk], [twin], [])).toEqual([
      { localDate: '2026-10-02', minutes: 60 },
    ]);
  });
});
