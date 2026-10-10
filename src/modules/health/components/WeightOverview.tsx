import { formatWeight, formatWeightChange, useWeightData } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { Button, Icon, ICON_FOR } from '@/ui';
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
        <div className={styles.current}>
          <span className={styles.icon}>
            <Icon name={ICON_FOR.weight} size={20} />
          </span>
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
        </div>
      ) : recent.status === 'ready' ? (
        // No value yet: said in words, with a quiet (neutral) tile – never a 0.
        <div className={styles.current} data-empty="true">
          <span className={styles.icon}>
            <Icon name={ICON_FOR.weight} size={20} />
          </span>
          <p className={styles.meta}>{t('weight.empty')}</p>
        </div>
      ) : null}
      <Button fullWidth onClick={onAdd}>
        {t('weight.add')}
      </Button>
    </div>
  );
}
