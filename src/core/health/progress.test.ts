import { mergeWeightDays, summarizeActivities, summarizeWeightPeriod } from './progress';

const WEEK = [
  '2026-09-27',
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
];

describe('weight progress', () => {
  it('keeps one value per day; an own entry wins over an imported one', () => {
    expect(
      mergeWeightDays(
        [
          { date: '2026-10-03', kg: 92 },
          { date: '2026-09-28', kg: 93 },
        ],
        [
          { date: '2026-10-03', kg: 95 },
          { date: '2026-09-30', kg: 92.6 },
        ],
      ),
    ).toEqual([
      { date: '2026-09-28', kg: 93, source: 'own' },
      { date: '2026-09-30', kg: 92.6, source: 'imported' },
      { date: '2026-10-03', kg: 92, source: 'own' },
    ]);
  });

  it('is empty without values', () => {
    expect(summarizeWeightPeriod([], '2026-09-27', '2026-10-03')).toEqual({
      latest: null,
      changeKg: null,
      points: [],
    });
  });

  it('shows the latest value even when it is older than the period, without a change', () => {
    const summary = summarizeWeightPeriod(
      [{ date: '2026-09-01', kg: 82, source: 'own' }],
      '2026-09-27',
      '2026-10-03',
    );
    expect(summary.latest?.kg).toBe(82);
    expect(summary.changeKg).toBeNull();
    expect(summary.points).toEqual([]);
  });

  it('measures the change from the first to the last value within the period', () => {
    const summary = summarizeWeightPeriod(
      [
        { date: '2026-08-01', kg: 94, source: 'own' }, // before the period
        { date: '2026-09-10', kg: 93, source: 'own' },
        { date: '2026-09-20', kg: 92.4, source: 'imported' },
        { date: '2026-10-03', kg: 91.8, source: 'own' },
      ],
      '2026-09-04',
      '2026-10-03',
    );
    expect(summary.latest).toEqual({ date: '2026-10-03', kg: 91.8, source: 'own' });
    expect(summary.changeKg).toBe(-1.2);
    expect(summary.points.map((point) => point.date)).toEqual([
      '2026-09-10',
      '2026-09-20',
      '2026-10-03',
    ]);
  });
});

describe('activity progress', () => {
  const activity = (
    externalId: string,
    localDate: string,
    minutes: number,
    kcal: number | null,
  ) => ({ externalId, localDate, durationS: minutes * 60, activeKcal: kcal });

  it('counts each imported activity once with its duration and reported calories', () => {
    const summary = summarizeActivities(
      [
        activity('a', '2026-10-03', 42, 386.4),
        activity('a', '2026-10-03', 42, 386.4), // the same record twice
        activity('b', '2026-10-01', 60, 520),
        activity('c', '2026-09-29', 30, null),
        activity('d', '2026-09-01', 90, 900), // outside the period
      ],
      WEEK,
    );
    expect(summary).toEqual({
      count: 3,
      durationS: 132 * 60,
      activeKcal: 906,
      activeDays: 3,
      perDay: [
        { date: '2026-09-27', minutes: 0 },
        { date: '2026-09-28', minutes: 0 },
        { date: '2026-09-29', minutes: 30 },
        { date: '2026-09-30', minutes: 0 },
        { date: '2026-10-01', minutes: 60 },
        { date: '2026-10-02', minutes: 0 },
        { date: '2026-10-03', minutes: 42 },
      ],
    });
  });

  it('has no calories when no activity reported any – not 0', () => {
    expect(
      summarizeActivities([activity('a', '2026-10-03', 30, null)], WEEK).activeKcal,
    ).toBeNull();
  });
});
