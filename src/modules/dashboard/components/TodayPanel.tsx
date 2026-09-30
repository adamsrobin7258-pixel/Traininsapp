import { useI18n } from '@/core/i18n';
import { Stat } from '@/ui';
import { formatSummaryValue, type TodaySummary } from '../domain/todaySummary';
import styles from './TodayPanel.module.css';

export function TodayPanel({ summary }: { summary: TodaySummary }) {
  const { locale, t } = useI18n();
  const empty = t('common.noValue');
  return (
    <div className={styles.panel}>
      <Stat
        label={t('dashboard.metrics.steps')}
        value={formatSummaryValue(summary.steps, locale)}
        emptyLabel={empty}
      />
      <Stat
        label={t('dashboard.metrics.energy')}
        value={formatSummaryValue(summary.energyKcal, locale)}
        emptyLabel={empty}
      />
      <Stat
        label={t('dashboard.metrics.training')}
        value={formatSummaryValue(summary.trainingMinutes, locale)}
        emptyLabel={empty}
      />
    </div>
  );
}
