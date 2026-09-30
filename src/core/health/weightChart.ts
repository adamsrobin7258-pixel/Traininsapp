import { parseLocalDateKey } from '@/shared/lib/date';

/**
 * Geometry for the weight line chart, independent of React and SVG details.
 * X is proportional to calendar days (gaps stay visible), Y to the value.
 */
export interface ChartInputPoint {
  date: string;
  value: number;
}

export interface ChartPoint extends ChartInputPoint {
  x: number;
  y: number;
}

export interface ChartGeometry {
  points: ChartPoint[];
  /** SVG path for the line. */
  path: string;
  /** Value range shown on the Y axis (rounded outward). */
  yMin: number;
  yMax: number;
  yMinPosition: number;
  yMaxPosition: number;
}

export interface ChartBox {
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Keeps small fluctuations readable instead of stretching 0.1 kg over the full height. */
const MIN_SPAN = 2;

function dayNumber(date: string): number {
  const parsed = parseLocalDateKey(date);
  if (!parsed) throw new Error(`Invalid date ${date}`);
  return Math.round(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()) / 86_400_000,
  );
}

export function buildChartGeometry(
  input: readonly ChartInputPoint[],
  box: ChartBox,
): ChartGeometry | null {
  if (input.length < 2) return null;

  const values = input.map((p) => p.value);
  let low = Math.min(...values);
  let high = Math.max(...values);
  if (high - low < MIN_SPAN) {
    const middle = (high + low) / 2;
    low = middle - MIN_SPAN / 2;
    high = middle + MIN_SPAN / 2;
  }
  const yMin = Math.floor(low);
  const yMax = Math.ceil(high);

  const days = input.map((p) => dayNumber(p.date));
  const firstDay = days[0] ?? 0;
  const daySpan = Math.max(1, (days.at(-1) ?? firstDay) - firstDay);
  const plotWidth = box.width - box.left - box.right;
  const plotHeight = box.height - box.top - box.bottom;

  const toY = (value: number) => box.top + ((yMax - value) / (yMax - yMin)) * plotHeight;
  const round = (n: number) => Math.round(n * 10) / 10;

  const points = input.map((p, index) => ({
    ...p,
    x: round(box.left + (((days[index] ?? firstDay) - firstDay) / daySpan) * plotWidth),
    y: round(toY(p.value)),
  }));

  return {
    points,
    path: points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' '),
    yMin,
    yMax,
    yMinPosition: round(toY(yMin)),
    yMaxPosition: round(toY(yMax)),
  };
}
