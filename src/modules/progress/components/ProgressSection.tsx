import { useMemo, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { parseLocalDateKey } from '@/shared/lib/date';
import { formatDayMonth } from '@/shared/lib/format';
import { SegmentedControl } from '@/ui';
import {
  periodRange,
  previousPeriodRange,
  PROGRESS_PERIODS,
  type ProgressPeriod,
} from '../domain/period';
import { ProgressCalendar } from './ProgressCalendar';
import { ScoreCard } from './ScoreCard';
import styles from './Progress.module.css';

/**
 * The compact main page (Phase 23): the Kalethra score of today (the default) or the last 7 or 30
 * days with its four areas – each opens its area – then the calendar of the last 20 days with
 * completed workouts and met calorie goals. Nothing is entered or calculated here; the score and
 * the calendar get their values ready-made from the services.
 */
export function ProgressSection({ now }: { now: Date }) {
  const { t, locale } = useI18n();
  const [period, setPeriod] = useState<ProgressPeriod>('today');
  const todayKey = now.toDateString();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed per day, not per minute
  const range = useMemo(() => periodRange(now, period), [todayKey, period]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed per day, not per minute
  const previous = useMemo(() => previousPeriodRange(now, period), [todayKey, period]);
  const day = (date: string) => formatDayMonth(parseLocalDateKey(date) ?? now, locale);

  return (
    <div className={styles.progress}>
      <SegmentedControl
        label={t('progress.periodLabel')}
        options={PROGRESS_PERIODS.map((value) => ({
          value,
          label: t(`progress.periods.${value}`),
        }))}
        value={period}
        onChange={setPeriod}
      />
      <p className={styles.range}>
        <span className="visually-hidden">{t(`progress.rangeHint.${period}`)} </span>
        {range.from === range.to
          ? t('progress.rangeDay', { day: day(range.to) })
          : t('progress.range', { from: day(range.from), to: day(range.to) })}
      </p>
      <ScoreCard period={period} range={range} previous={previous} />
      <ProgressCalendar now={now} />
    </div>
  );
}
