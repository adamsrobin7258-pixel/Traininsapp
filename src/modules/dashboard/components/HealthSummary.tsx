import { ROUTES } from '@/app/routes';
import { formatWeight, formatWeightChange, useLatestWeight, useWeightTrend } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { formatDayMonth } from '@/shared/lib/format';
import { summarizeWeight } from '../domain/weightSummary';
import { OverviewCard, OverviewNote } from './OverviewCard';
import styles from './HealthSummary.module.css';

/**
 * Health at a glance. Weight is currently the only health value the app records; further
 * values appear here once their area stores them – none are invented for this overview.
 */
export function HealthSummary({ now }: { now: Date }) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const trend = useWeightTrend('3m');
  const latest = useLatestWeight();

  const entries = trend.status === 'ready' ? trend.data : [];
  // The latest entry can be older than the trend window.
  const newest = latest.status === 'ready' ? latest.data : null;
  const summary = summarizeWeight(
    newest && !entries.some((e) => e.date === newest.date) ? [...entries, newest] : entries,
    toLocalDateKey(now),
  );
  const ready = trend.status === 'ready' && latest.status === 'ready';

  return (
    <OverviewCard icon="scale" title={t('dashboard.health.title')} to={ROUTES.health}>
      <span className={styles.row}>
        <span className={styles.text}>
          <span className={styles.label}>{t('dashboard.health.weight')}</span>
          {summary.latest ? (
            <>
              <span className={styles.value}>{formatWeight(summary.latest.kg, unit, locale)}</span>
              {summary.change ? (
                <OverviewNote>
                  {t('weight.changeSince', {
                    change: formatWeightChange(summary.change.deltaKg, unit, locale),
                    date: formatDayMonth(parseLocalDateKey(summary.change.since) ?? now, locale),
                  })}
                </OverviewNote>
              ) : null}
            </>
          ) : ready ? (
            <OverviewNote>{t('dashboard.health.weightNone')}</OverviewNote>
          ) : null}
        </span>
        {summary.trendPoints ? (
          <svg
            className={styles.trend}
            viewBox="0 0 100 32"
            preserveAspectRatio="none"
            role="img"
            aria-label={t('dashboard.health.trend')}
          >
            <polyline
              points={summary.trendPoints}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : null}
      </span>
    </OverviewCard>
  );
}
