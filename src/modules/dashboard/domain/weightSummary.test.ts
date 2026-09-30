import { summarizeWeight } from './weightSummary';

describe('summarizeWeight', () => {
  it('is empty without entries', () => {
    expect(summarizeWeight([], '2026-10-03')).toEqual({
      latest: null,
      change: null,
      trendPoints: null,
    });
  });

  it('shows a single entry without change or trend', () => {
    const summary = summarizeWeight([{ date: '2026-10-01', kg: 82 }], '2026-10-03');
    expect(summary.latest).toEqual({ date: '2026-10-01', kg: 82 });
    expect(summary.change).toBeNull();
    expect(summary.trendPoints).toBeNull();
  });

  it('measures the change within the last 30 days and draws the last 90 days', () => {
    const summary = summarizeWeight(
      [
        { date: '2026-06-01', kg: 95 }, // older than 90 days: not drawn
        { date: '2026-08-01', kg: 94 }, // in the trend, before the change window
        { date: '2026-09-10', kg: 93 },
        { date: '2026-10-03', kg: 91.8 },
      ],
      '2026-10-03',
    );
    expect(summary.latest?.kg).toBe(91.8);
    expect(summary.change?.since).toBe('2026-09-10');
    expect(summary.change?.deltaKg).toBeCloseTo(-1.2, 5);
    const points = summary.trendPoints?.split(' ') ?? [];
    expect(points).toHaveLength(3);
    // Oldest drawn point on the left and highest, newest on the right and lowest.
    expect(points[0]).toBe('0.0,3.0');
    expect(points[2]).toBe('100.0,29.0');
  });

  it('draws a flat line for equal values', () => {
    const summary = summarizeWeight(
      [
        { date: '2026-10-01', kg: 80 },
        { date: '2026-10-02', kg: 80 },
      ],
      '2026-10-03',
    );
    expect(summary.trendPoints).toBe('0.0,16.0 100.0,16.0');
  });
});
