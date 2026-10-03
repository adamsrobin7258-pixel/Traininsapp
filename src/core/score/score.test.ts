import { PRELIMINARY, SCORE_AREAS, SCORE_WEIGHTS, TREND_THRESHOLD, type ScoreGoal } from './config';
import {
  activityScore,
  calculateScore,
  kcalDayScore,
  minDocumentedDays,
  nutritionScore,
  proteinDayScore,
  recoveryScore,
  scoreBand,
  scoreTrend,
  trainingScore,
  type ScoreInput,
} from './score';

const TODAY = '2026-10-03';
/** The last `n` days up to TODAY (3 October 2026), oldest first. */
const days = (n: number, end = 3) =>
  Array.from({ length: n }, (_, i) => {
    const date = new Date(2026, 9, end - (n - 1) + i);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  });
const WEEK = days(7);
const MONTH = days(30);

function input(patch: Partial<ScoreInput> = {}): ScoreInput {
  return {
    goal: 'maintain',
    dates: WEEK,
    today: TODAY,
    nutrition: { totals: [], goals: [] },
    training: { workoutsPerDay: [] },
    activity: { minutesPerDay: [] },
    recovery: [],
    targets: { trainingsPerWeek: null, activeMinutesPerWeek: null },
    ...patch,
  };
}

/** Logged days with kcal/protein and a goal of 2300 kcal / 160 g on every day of the week. */
function eating(entries: [date: string, kcal: number, protein: number][], proteinGoal = 160) {
  return {
    totals: entries.map(([localDate, energyKcal, proteinG]) => ({
      localDate,
      energyKcal,
      proteinG,
    })),
    goals: WEEK.map((localDate) => ({ localDate, energyKcal: 2300, proteinG: proteinGoal })),
  };
}

describe('configuration', () => {
  it('has weights for every main goal that add up to 100 %', () => {
    for (const goal of Object.keys(SCORE_WEIGHTS) as ScoreGoal[]) {
      const sum = SCORE_AREAS.reduce((total, area) => total + SCORE_WEIGHTS[goal][area], 0);
      expect(sum, goal).toBeCloseTo(1, 10);
    }
  });

  it('uses the agreed product weights', () => {
    expect(SCORE_WEIGHTS.lose).toEqual({
      nutrition: 0.45,
      training: 0.25,
      activity: 0.2,
      recovery: 0.1,
    });
    expect(SCORE_WEIGHTS.gain).toEqual({
      nutrition: 0.3,
      training: 0.45,
      activity: 0.1,
      recovery: 0.15,
    });
    expect(SCORE_WEIGHTS.maintain).toEqual({
      nutrition: 0.4,
      training: 0.25,
      activity: 0.25,
      recovery: 0.1,
    });
    expect(SCORE_WEIGHTS.fitness).toEqual({
      nutrition: 0.3,
      training: 0.3,
      activity: 0.25,
      recovery: 0.15,
    });
  });
});

describe('nutrition', () => {
  it('gives 100 when the goal is met (±5 %)', () => {
    expect(kcalDayScore(2300, 2300, false)).toBe(100);
    expect(kcalDayScore(2400, 2300, false)).toBe(100); // +4.3 %
    expect(kcalDayScore(2200, 2300, false)).toBe(100);
  });

  it('costs little for a slight excess and a lot only for a large one', () => {
    // +10 % → 90, +20 % → 70, +30 % → 50, +55 % → 0.
    expect(kcalDayScore(2530, 2300, false)).toBeCloseTo(90, 5);
    expect(kcalDayScore(2760, 2300, false)).toBeCloseTo(70, 5);
    expect(kcalDayScore(2990, 2300, false)).toBeCloseTo(50, 5);
    expect(kcalDayScore(3565, 2300, false)).toBe(0);
    expect(kcalDayScore(6000, 2300, false)).toBe(0);
  });

  it('changes gradually – no jumps between neighbouring values', () => {
    for (let kcal = 2000; kcal <= 3500; kcal += 10) {
      const a = kcalDayScore(kcal, 2300, false) ?? 0;
      const b = kcalDayScore(kcal + 10, 2300, false) ?? 0;
      expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
    }
  });

  it('does not judge today below the goal – the day is not over', () => {
    expect(kcalDayScore(900, 2300, true)).toBeNull();
    expect(kcalDayScore(2990, 2300, true)).toBeCloseTo(50, 5);
    expect(proteinDayScore(40, 160, true)).toBeNull();
    expect(proteinDayScore(150, 160, true)).toBe(100);
  });

  it('rewards reaching the protein goal and judges a shortfall moderately', () => {
    expect(proteinDayScore(160, 160, false)).toBe(100);
    expect(proteinDayScore(144, 160, false)).toBe(100); // 90 %
    expect(proteinDayScore(250, 160, false)).toBe(100); // more is never a penalty
    expect(proteinDayScore(128, 160, false)).toBeCloseTo(80, 5); // 80 %
    expect(proteinDayScore(80, 160, false)).toBeCloseTo(20, 5); // 50 %
  });

  it('weighs calories 70 % and protein 30 % per day and averages the logged days', () => {
    const result = nutritionScore(
      input({
        nutrition: eating([
          ['2026-10-01', 2300, 160], // 100
          ['2026-10-02', 2760, 128], // 70 × 0.7 + 80 × 0.3 = 73
        ]),
      }),
    );
    expect(result.score).toBe(87); // (100 + 73) / 2 = 86.5
    expect(result.detail).toMatchObject({
      loggedDays: 2,
      ratedDays: 2,
      avgKcalDeviationPct: 10,
      proteinRatedDays: 2,
      proteinReachedDays: 1,
    });
  });

  it('never counts missing days as bad days', () => {
    const fourDays = nutritionScore(
      input({
        nutrition: eating([
          ['2026-09-28', 2300, 160],
          ['2026-09-29', 2300, 160],
          ['2026-09-30', 2300, 160],
          ['2026-10-01', 2300, 160],
        ]),
      }),
    );
    expect(fourDays.score).toBe(100);
    expect(fourDays.detail.loggedDays).toBe(4);
    expect(nutritionScore(input()).score).toBeNull();
  });

  it('uses the given day goals – a manual protein goal of 220 g', () => {
    const result = nutritionScore(input({ nutrition: eating([['2026-10-02', 2300, 160]], 220) }));
    // 160 / 220 = 72.7 % → 100 − 17.3 × 2 = 65.5 → 0.7 × 100 + 0.3 × 65.5 = 89.6
    expect(result.score).toBe(90);
  });

  it('follows the day goal including activity calories when the setting is on', () => {
    const eaten = eating([['2026-10-02', 2800, 160]]);
    const off = nutritionScore(input({ nutrition: eaten }));
    const on = nutritionScore(
      input({
        nutrition: {
          totals: eaten.totals,
          goals: WEEK.map((localDate) => ({
            localDate,
            energyKcal: localDate === '2026-10-02' ? 2800 : 2300,
            proteinG: 160,
          })),
        },
      }),
    );
    // 2800 against 2300 is +21.7 % (off); against 2300 + 500 it is on target (on).
    expect(off.score).toBeLessThan(80);
    expect(on.score).toBe(100);
  });

  it('rates only what has a goal', () => {
    const result = nutritionScore(
      input({
        nutrition: {
          totals: [{ localDate: '2026-10-02', energyKcal: 2300, proteinG: 50 }],
          goals: [{ localDate: '2026-10-02', energyKcal: 2300, proteinG: null }],
        },
      }),
    );
    expect(result.score).toBe(100);
    expect(result.detail.proteinRatedDays).toBe(0);
  });
});

describe('training', () => {
  const workouts = (dates: string[]) => ({
    workoutsPerDay: dates.map((localDate) => ({ localDate, workouts: 1 })),
  });

  it('is 100 when the planned sessions were done', () => {
    const result = trainingScore(
      input({
        training: workouts(['2026-09-28', '2026-09-30', '2026-10-02']),
        targets: { trainingsPerWeek: 3, activeMinutesPerWeek: null },
      }),
    );
    expect(result).toEqual({
      score: 100,
      detail: { target: 3, done: 3, expected: 3, restDays: 0 },
    });
  });

  it('goes down for planned sessions that were missed', () => {
    const result = trainingScore(
      input({
        training: workouts(['2026-09-28', '2026-09-30']),
        targets: { trainingsPerWeek: 4, activeMinutesPerWeek: null },
      }),
    );
    expect(result.score).toBe(50);
    expect(result.detail).toMatchObject({ done: 2, expected: 4 });
  });

  it('gives no bonus for more sessions than planned', () => {
    const result = trainingScore(
      input({
        training: workouts(WEEK),
        targets: { trainingsPerWeek: 3, activeMinutesPerWeek: null },
      }),
    );
    expect(result.score).toBe(100);
  });

  it('never penalises rest days by themselves', () => {
    const result = trainingScore(
      input({
        training: workouts(['2026-09-28', '2026-09-30', '2026-10-02']),
        recovery: [
          { localDate: '2026-09-29', state: 'good', restDay: true },
          { localDate: '2026-10-01', state: null, restDay: true },
        ],
        targets: { trainingsPerWeek: 3, activeMinutesPerWeek: null },
      }),
    );
    expect(result.score).toBe(100);
    expect(result.detail.restDays).toBe(2);
  });

  it('is neutral without a training target', () => {
    const result = trainingScore(input({ training: workouts(['2026-10-02']) }));
    expect(result.score).toBeNull();
    expect(result.detail).toMatchObject({ target: null, done: 1 });
  });

  it('scales the target to 30 days', () => {
    const result = trainingScore(
      input({
        dates: MONTH,
        training: workouts(MONTH.filter((_, i) => i % 3 === 0)), // 10 sessions
        targets: { trainingsPerWeek: 3, activeMinutesPerWeek: null },
      }),
    );
    expect(result.detail.expected).toBe(12.9);
    expect(result.score).toBe(78); // 10 / 12.86
  });

  it('today: a workout is 100, none is not judged yet', () => {
    const today = { dates: [TODAY], targets: { trainingsPerWeek: 3, activeMinutesPerWeek: null } };
    expect(trainingScore(input({ ...today, training: workouts([TODAY]) })).score).toBe(100);
    expect(trainingScore(input(today)).score).toBeNull();
  });
});

describe('activity', () => {
  const minutes = (entries: [string, number][]) => ({
    minutesPerDay: entries.map(([localDate, value]) => ({ localDate, minutes: value })),
  });

  it('compares the active minutes with the weekly target', () => {
    const result = activityScore(
      input({
        activity: minutes([
          ['2026-09-29', 45],
          ['2026-10-01', 30],
        ]),
        targets: { trainingsPerWeek: null, activeMinutesPerWeek: 150 },
      }),
    );
    expect(result).toEqual({
      score: 50,
      detail: {
        target: 150,
        minutes: 75,
        expectedMinutes: 150,
        activeDays: 2,
        minutesScore: 50,
        // No step goal: the steps signal is not rated and changes nothing.
        steps: { target: null, avgSteps: null, ratedDays: 0, reachedDays: 0, score: null },
      },
    });
  });

  it('is capped at 100 – lots of activity gives no extra points', () => {
    const result = activityScore(
      input({
        activity: minutes(WEEK.map((date) => [date, 180])),
        targets: { trainingsPerWeek: null, activeMinutesPerWeek: 150 },
      }),
    );
    expect(result.score).toBe(100);
  });

  it('is neutral without a target', () => {
    expect(activityScore(input({ activity: minutes([['2026-10-01', 60]]) })).score).toBeNull();
  });

  it('is neutral without any activity data – not tracked is not "not active"', () => {
    const result = activityScore(
      input({ targets: { trainingsPerWeek: null, activeMinutesPerWeek: 150 } }),
    );
    expect(result.score).toBeNull();
    expect(result.detail.minutes).toBe(0);
  });
});

describe('recovery', () => {
  it('rates good, moderate and poor', () => {
    const rate = (state: 'good' | 'moderate' | 'poor') =>
      recoveryScore(input({ recovery: [{ localDate: TODAY, state, restDay: false }] })).score;
    expect(rate('good')).toBe(100);
    expect(rate('moderate')).toBe(60);
    expect(rate('poor')).toBe(20);
  });

  it('a rest day is no minus by itself – it counts through how recovered one felt', () => {
    const goodRest = recoveryScore(
      input({ recovery: [{ localDate: TODAY, state: 'good', restDay: true }] }),
    );
    expect(goodRest.score).toBe(100);
    const poorRest = recoveryScore(
      input({ recovery: [{ localDate: TODAY, state: 'poor', restDay: true }] }),
    );
    expect(poorRest.score).toBe(20);
    const onlyRest = recoveryScore(
      input({ recovery: [{ localDate: TODAY, state: null, restDay: true }] }),
    );
    expect(onlyRest.score).toBeNull();
    expect(onlyRest.detail.restDays).toBe(1);
  });

  it('is neutral without entries – not entered is not "poorly recovered"', () => {
    expect(recoveryScore(input()).score).toBeNull();
  });

  it('averages the entered days', () => {
    const result = recoveryScore(
      input({
        recovery: [
          { localDate: '2026-10-01', state: 'good', restDay: false },
          { localDate: '2026-10-02', state: 'good', restDay: false },
          { localDate: '2026-10-03', state: 'moderate', restDay: false },
        ],
      }),
    );
    expect(result.score).toBe(87);
    expect(result.detail).toMatchObject({ entries: 3, good: 2, moderate: 1, poor: 0 });
  });
});

describe('total score', () => {
  /** A full week: every area rated. */
  function fullWeek(goal: ScoreGoal | null): ScoreInput {
    return input({
      goal,
      // Nutrition 100 on four days.
      nutrition: eating(WEEK.slice(0, 4).map((date) => [date, 2300, 160])),
      // Training 2 of 4 → 50.
      training: {
        workoutsPerDay: [
          { localDate: WEEK[0] ?? '', workouts: 1 },
          { localDate: WEEK[2] ?? '', workouts: 1 },
        ],
      },
      // Activity 75 of 150 → 50.
      activity: { minutesPerDay: [{ localDate: WEEK[1] ?? '', minutes: 75 }] },
      // Recovery good → 100.
      recovery: [{ localDate: WEEK[3] ?? '', state: 'good', restDay: false }],
      targets: { trainingsPerWeek: 4, activeMinutesPerWeek: 150 },
    });
  }

  it.each([
    // nutrition 100, training 50, activity 50, recovery 100
    ['lose', 100 * 0.45 + 50 * 0.25 + 50 * 0.2 + 100 * 0.1],
    ['gain', 100 * 0.3 + 50 * 0.45 + 50 * 0.1 + 100 * 0.15],
    ['maintain', 100 * 0.4 + 50 * 0.25 + 50 * 0.25 + 100 * 0.1],
    ['fitness', 100 * 0.3 + 50 * 0.3 + 50 * 0.25 + 100 * 0.15],
  ] as const)('weighs the areas for the goal "%s"', (goal, expected) => {
    const result = calculateScore(fullWeek(goal));
    expect(result.areas.nutrition.score).toBe(100);
    expect(result.areas.training.score).toBe(50);
    expect(result.areas.activity.score).toBe(50);
    expect(result.areas.recovery.score).toBe(100);
    expect(result.score).toBe(Math.round(expected));
    expect(result.goal).toBe(goal);
    expect(result.ratedAreas).toBe(4);
  });

  it('gives different totals for different goals from the same data', () => {
    const lose = calculateScore(fullWeek('lose')).score;
    const gain = calculateScore(fullWeek('gain')).score;
    expect(lose).toBe(78);
    expect(gain).toBe(73);
  });

  it('weighs like "general fitness" without a nutrition profile', () => {
    const result = calculateScore(fullWeek(null));
    expect(result.goal).toBe('fitness');
    expect(result.goalSet).toBe(false);
    expect(result.score).toBe(calculateScore(fullWeek('fitness')).score);
  });

  it('leaves unrated areas out and renormalises the weights', () => {
    const result = calculateScore(
      input({
        goal: 'lose',
        nutrition: eating(WEEK.slice(0, 4).map((date) => [date, 2760, 128])), // 73
        recovery: [{ localDate: TODAY, state: 'good', restDay: false }], // 100
      }),
    );
    // (73 × 0.45 + 100 × 0.1) / 0.55 = 77.9
    expect(result.score).toBe(78);
    expect(result.ratedAreas).toBe(2);
  });

  it('stays within 0–100', () => {
    const worst = calculateScore(
      input({
        nutrition: eating(WEEK.map((date) => [date, 9000, 0])),
        recovery: WEEK.map((localDate) => ({ localDate, state: 'poor' as const, restDay: false })),
        training: { workoutsPerDay: [] },
        targets: { trainingsPerWeek: 7, activeMinutesPerWeek: null },
      }),
    );
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
    const best = calculateScore(fullWeek('lose'));
    expect(best.score).toBeLessThanOrEqual(100);
  });

  it('is deterministic', () => {
    expect(calculateScore(fullWeek('lose'))).toEqual(calculateScore(fullWeek('lose')));
  });

  it('has no number at all without any rateable data', () => {
    const result = calculateScore(input());
    expect(result.score).toBeNull();
    expect(result.band).toBeNull();
    expect(result.preliminary).toBe(false);
  });

  it('names a band for the total', () => {
    expect(scoreBand(92)).toBe('excellent');
    expect(scoreBand(85)).toBe('excellent');
    expect(scoreBand(78)).toBe('good');
    expect(scoreBand(55)).toBe('partial');
    expect(scoreBand(20)).toBe('low');
  });
});

describe('preliminary', () => {
  it('needs half of the period documented: 1 of 1, 4 of 7, 15 of 30 days', () => {
    expect(PRELIMINARY.documentedShare).toBe(0.5);
    expect(minDocumentedDays(1)).toBe(1);
    expect(minDocumentedDays(7)).toBe(4);
    expect(minDocumentedDays(30)).toBe(15);
  });

  it('is shown but preliminary with few days', () => {
    const result = calculateScore(
      input({
        nutrition: eating([['2026-10-01', 2300, 160]]),
        recovery: [{ localDate: '2026-10-02', state: 'good', restDay: false }],
      }),
    );
    expect(result.score).toBe(100);
    expect(result.documentedDays).toBe(2);
    expect(result.preliminary).toBe(true);
  });

  it('is preliminary with only one rated area, however many days', () => {
    const result = calculateScore(
      input({ nutrition: eating(WEEK.map((date) => [date, 2300, 160])) }),
    );
    expect(result.documentedDays).toBe(7);
    expect(result.ratedAreas).toBe(1);
    expect(result.preliminary).toBe(true);
  });

  it('is final with enough days and at least two areas', () => {
    const result = calculateScore(
      input({
        nutrition: eating(WEEK.slice(0, 4).map((date) => [date, 2300, 160])),
        recovery: [{ localDate: WEEK[0] ?? '', state: 'good', restDay: false }],
      }),
    );
    expect(result.documentedDays).toBe(4);
    expect(result.preliminary).toBe(false);
  });

  it('counts every kind of own entry as a documented day', () => {
    const result = calculateScore(
      input({
        nutrition: eating([[WEEK[0] ?? '', 2300, 160]]),
        training: { workoutsPerDay: [{ localDate: WEEK[1] ?? '', workouts: 1 }] },
        activity: { minutesPerDay: [{ localDate: WEEK[2] ?? '', minutes: 30 }] },
        recovery: [{ localDate: WEEK[3] ?? '', state: null, restDay: true }],
      }),
    );
    expect(result.documentedDays).toBe(4);
  });
});

describe('trend', () => {
  const previous = (score: number | null, documentedDays = 7) => ({ score, documentedDays });

  it('improved, worse, about the same', () => {
    expect(scoreTrend({ score: 80 }, previous(70), 7)).toEqual({ trend: 'up', delta: 10 });
    expect(scoreTrend({ score: 60 }, previous(70), 7)).toEqual({ trend: 'down', delta: -10 });
    expect(scoreTrend({ score: 72 }, previous(70), 7)).toEqual({ trend: 'steady', delta: 2 });
    expect(scoreTrend({ score: 68 }, previous(70), 7)).toEqual({ trend: 'steady', delta: -2 });
  });

  it('has a small neutral zone of 3 points', () => {
    expect(TREND_THRESHOLD).toBe(3);
    expect(scoreTrend({ score: 73 }, previous(70), 7).trend).toBe('up');
    expect(scoreTrend({ score: 67 }, previous(70), 7).trend).toBe('down');
  });

  it('has no trend without enough comparison data', () => {
    expect(scoreTrend({ score: 80 }, previous(null), 7).trend).toBe('none');
    expect(scoreTrend({ score: null }, previous(70), 7).trend).toBe('none');
    expect(scoreTrend({ score: 80 }, previous(70, 3), 7).trend).toBe('none');
    expect(scoreTrend({ score: 80 }, previous(70, 1), 1).trend).toBe('up');
  });
});

describe('activity area with steps (Phase 14 follow-up)', () => {
  const activity = (
    minutes: [string, number][],
    steps: [string, number][],
  ): ScoreInput['activity'] => ({
    minutesPerDay: minutes.map(([localDate, value]) => ({ localDate, minutes: value })),
    stepsPerDay: steps.map(([localDate, value]) => ({ localDate, steps: value })),
  });
  const targets = (activeMinutesPerWeek: number | null, stepsPerDay: number | null) => ({
    trainingsPerWeek: null,
    activeMinutesPerWeek,
    stepsPerDay,
  });

  it('G: only steps → the activity area is rated by the steps', () => {
    const result = activityScore(
      input({
        activity: activity(
          [],
          [
            ['2026-09-30', 10_000],
            ['2026-10-01', 6_000],
          ],
        ),
        targets: targets(150, 10_000),
      }),
    );
    // (100 + 60) / 2; active minutes have no data → not rated, not 0.
    expect(result.score).toBe(80);
    expect(result.detail.minutesScore).toBeNull();
    expect(result.detail.steps).toEqual({
      target: 10_000,
      avgSteps: 8000,
      ratedDays: 2,
      reachedDays: 1,
      score: 80,
    });
  });

  it('H: only active minutes → exactly the previous behaviour', () => {
    const withoutSteps = activityScore(
      input({ activity: activity([['2026-09-29', 75]], []), targets: targets(150, 10_000) }),
    );
    const before = activityScore(
      input({
        activity: { minutesPerDay: [{ localDate: '2026-09-29', minutes: 75 }] },
        targets: { trainingsPerWeek: null, activeMinutesPerWeek: 150 },
      }),
    );
    expect(withoutSteps.score).toBe(50);
    expect(before.score).toBe(50);
  });

  it('I: both → the mean of active minutes and steps, not their sum', () => {
    // Minutes: 120 of 150 → 80; steps: 6.000 of 10.000 → 60 → 70.
    const result = activityScore(
      input({
        activity: activity([['2026-09-29', 120]], [['2026-09-29', 6_000]]),
        targets: targets(150, 10_000),
      }),
    );
    expect(result.detail.minutesScore).toBe(80);
    expect(result.detail.steps.score).toBe(60);
    expect(result.score).toBe(70);
  });

  it('E: no step data → the steps part is neutral, never 0', () => {
    const result = activityScore(
      input({ activity: activity([['2026-09-29', 120]], []), targets: targets(150, 10_000) }),
    );
    expect(result.detail.steps).toMatchObject({ ratedDays: 0, score: null, avgSteps: null });
    expect(result.score).toBe(80);
  });

  it('F: neither activity nor step data → the area stays neutral', () => {
    expect(
      activityScore(input({ activity: activity([], []), targets: targets(150, 10_000) })).score,
    ).toBeNull();
  });

  it('days without a step goal are neutral; each day uses its own goal version', () => {
    const goal = (date: string) =>
      date < '2026-10-01' ? null : date < '2026-10-02' ? 5000 : 10_000;
    const result = activityScore(
      input({
        activity: activity(
          [],
          [
            ['2026-09-29', 1_000], // no goal yet → not rated
            ['2026-10-01', 5_000], // 5.000 of 5.000 → 100
            ['2026-10-02', 5_000], // 5.000 of 10.000 → 50
          ],
        ),
        targets: { trainingsPerWeek: null, activeMinutesPerWeek: null, stepsPerDay: goal },
      }),
    );
    expect(result.detail.steps).toMatchObject({ ratedDays: 2, reachedDays: 1, target: 10_000 });
    expect(result.score).toBe(75);
  });

  it('today is still running: below the step goal is not judged, reaching it is', () => {
    const today = (steps: number) =>
      activityScore(
        input({
          dates: [TODAY],
          activity: activity([], [[TODAY, steps]]),
          targets: targets(null, 10_000),
        }),
      );
    // 2.000 of 10.000 at 10:00 is no bad day.
    expect(today(2_000).score).toBeNull();
    expect(today(2_000).detail.steps.ratedDays).toBe(0);
    expect(today(12_000).score).toBe(100);
  });

  it('more steps than the goal give no bonus (capped at 100)', () => {
    expect(
      activityScore(
        input({ activity: activity([], [['2026-10-01', 40_000]]), targets: targets(null, 10_000) }),
      ).score,
    ).toBe(100);
  });

  it('steps are no area of their own: same four areas, same weights, 0–100', () => {
    const result = calculateScore(
      input({
        goal: 'lose',
        nutrition: eating([['2026-10-01', 2300, 160]]),
        activity: activity([], [['2026-10-01', 5_000]]),
        targets: targets(null, 10_000),
      }),
    );
    expect(SCORE_AREAS).toEqual(['nutrition', 'training', 'activity', 'recovery']);
    expect(Object.keys(result.areas)).toEqual([...SCORE_AREAS]);
    expect(result.weights).toEqual(SCORE_WEIGHTS.lose);
    expect(result.weights.activity).toBe(0.2);
    // Nutrition 100 (weight .45) and activity 50 (weight .2): (45 + 10) / .65 = 84.6 → 85.
    expect(result.areas.activity.score).toBe(50);
    expect(result.score).toBe(85);
    expect(result.ratedAreas).toBe(2);
  });
});
