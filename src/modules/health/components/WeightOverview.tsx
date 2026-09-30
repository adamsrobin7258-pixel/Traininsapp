import { formatWeight, formatWeightChange, useWeightData } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { Button } from '@/ui';
import { mediumDate, shortDate } from '../domain/dates';
import styles from './WeightOverview.module.css';

/** Current (latest) weight, change to the previous entry and the primary "add" action. */
export function WeightOverview({ onAdd }: { onAdd: () => void }) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const recent = useWeightData((service, profileId) => service.getHistory(profileId, 2), []);

  const [latest, previous] = recent.status === 'ready' ? recent.data : [];

  return (
    <div className={styles.panel}>
      {recent.status === 'error' ? (
        <p className={styles.meta} role="alert">
          {t('weight.errors.loadFailed')}
        </p>
      ) : latest ? (
        <div>
          <p className={styles.value}>{formatWeight(latest.kg, unit, locale)}</p>
          <p className={styles.meta}>
            {t('weight.latestOn', { date: mediumDate(latest.date, locale) })}
            {previous ? (
              <>
                {' · '}
                {t('weight.changeSince', {
                  change: formatWeightChange(latest.kg - previous.kg, unit, locale),
                  date: shortDate(previous.date, locale),
                })}
              </>
            ) : null}
          </p>
        </div>
      ) : recent.status === 'ready' ? (
        <p className={styles.meta}>{t('weight.empty')}</p>
      ) : null}
      <Button fullWidth onClick={onAdd}>
        {t('weight.add')}
      </Button>
    </div>
  );
}
