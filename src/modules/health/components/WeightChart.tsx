import { useState } from 'react';
import {
  buildChartGeometry,
  formatWeight,
  fromKg,
  toKg,
  useWeightTrend,
  WEIGHT_PERIODS,
  type ChartBox,
  type WeightPeriod,
} from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { SegmentedControl } from '@/ui';
import { longDate, shortDate } from '../domain/dates';
import styles from './WeightChart.module.css';

const BOX: ChartBox = { width: 320, height: 150, top: 12, right: 8, bottom: 22, left: 36 };
/** Above this many points the line alone reads better than individual dots. */
const MAX_DOTS = 31;

/** Minimal SVG line chart of the weight trend; no chart library. */
export function WeightChart() {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const [period, setPeriod] = useState<WeightPeriod>('3m');
  const trend = useWeightTrend(period);

  const entries = trend.status === 'ready' ? trend.data : [];
  const geometry = buildChartGeometry(
    entries.map((entry) => ({ date: entry.date, value: fromKg(entry.kg, unit) })),
    BOX,
  );
  const first = geometry?.points[0];
  const last = geometry?.points.at(-1);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

  return (
    <div className={styles.panel}>
      <SegmentedControl
        label={t('weight.periodLabel')}
        options={WEIGHT_PERIODS.map((value) => ({ value, label: t(`weight.periods.${value}`) }))}
        value={period}
        onChange={setPeriod}
      />
      {trend.status === 'error' ? (
        <p className={styles.note} role="alert">
          {t('weight.errors.loadFailed')}
        </p>
      ) : geometry && first && last ? (
        <svg
          className={styles.chart}
          viewBox={`0 0 ${BOX.width} ${BOX.height}`}
          role="img"
          aria-label={t('weight.chartLabel', {
            from: longDate(first.date, locale),
            to: longDate(last.date, locale),
            first: formatWeight(toKg(first.value, unit), unit, locale),
            last: formatWeight(toKg(last.value, unit), unit, locale),
          })}
        >
          <line
            className={styles.grid}
            x1={BOX.left}
            x2={BOX.width - BOX.right}
            y1={geometry.yMaxPosition}
            y2={geometry.yMaxPosition}
          />
          <line
            className={styles.grid}
            x1={BOX.left}
            x2={BOX.width - BOX.right}
            y1={geometry.yMinPosition}
            y2={geometry.yMinPosition}
          />
          <text
            className={styles.axis}
            x={BOX.left - 6}
            y={geometry.yMaxPosition + 4}
            textAnchor="end"
          >
            {number.format(geometry.yMax)}
          </text>
          <text
            className={styles.axis}
            x={BOX.left - 6}
            y={geometry.yMinPosition + 4}
            textAnchor="end"
          >
            {number.format(geometry.yMin)}
          </text>
          <text className={styles.axis} x={BOX.left} y={BOX.height - 4}>
            {shortDate(first.date, locale)}
          </text>
          <text
            className={styles.axis}
            x={BOX.width - BOX.right}
            y={BOX.height - 4}
            textAnchor="end"
          >
            {shortDate(last.date, locale)}
          </text>
          <path className={styles.line} d={geometry.path} />
          {geometry.points.length <= MAX_DOTS
            ? geometry.points.map((point) => (
                <circle key={point.date} className={styles.dot} cx={point.x} cy={point.y} r={2.5} />
              ))
            : null}
          <circle className={styles.latest} cx={last.x} cy={last.y} r={4} />
        </svg>
      ) : trend.status === 'ready' ? (
        <p className={styles.note}>{t('weight.chartTooFew')}</p>
      ) : null}
    </div>
  );
}
