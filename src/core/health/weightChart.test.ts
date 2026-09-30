import { buildChartGeometry, type ChartBox } from './weightChart';

const box: ChartBox = { width: 300, height: 120, top: 10, right: 10, bottom: 10, left: 40 };

describe('buildChartGeometry', () => {
  it('needs at least two points', () => {
    expect(buildChartGeometry([], box)).toBeNull();
    expect(buildChartGeometry([{ date: '2026-10-01', value: 80 }], box)).toBeNull();
  });

  it('spans the plot area and places higher values higher', () => {
    const geometry = buildChartGeometry(
      [
        { date: '2026-10-01', value: 84 },
        { date: '2026-10-03', value: 80 },
      ],
      box,
    );
    expect(geometry?.points.map((p) => p.x)).toEqual([40, 290]);
    const [first, last] = geometry?.points ?? [];
    expect(first!.y).toBeLessThan(last!.y);
    expect(geometry?.yMin).toBe(80);
    expect(geometry?.yMax).toBe(84);
    expect(geometry?.path).toBe(`M40 ${first!.y} L290 ${last!.y}`);
  });

  it('keeps gaps between days proportional', () => {
    const geometry = buildChartGeometry(
      [
        { date: '2026-10-01', value: 80 },
        { date: '2026-10-02', value: 81 },
        { date: '2026-10-11', value: 82 },
      ],
      box,
    );
    expect(geometry?.points.map((p) => p.x)).toEqual([40, 65, 290]);
  });

  it('uses a minimum visible span for flat data', () => {
    const geometry = buildChartGeometry(
      [
        { date: '2026-10-01', value: 80.1 },
        { date: '2026-10-02', value: 80.2 },
      ],
      box,
    );
    if (!geometry) throw new Error('expected geometry');
    expect(geometry.yMax - geometry.yMin).toBeGreaterThanOrEqual(2);
  });

  it('handles hundreds of points', () => {
    const points = Array.from({ length: 365 }, (_, i) => ({
      date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10),
      value: 80 + Math.sin(i / 10),
    }));
    const geometry = buildChartGeometry(points, box);
    expect(geometry?.points).toHaveLength(365);
    expect(geometry?.points.every((p) => p.x >= 40 && p.x <= 290 && p.y >= 10 && p.y <= 110)).toBe(
      true,
    );
  });
});
