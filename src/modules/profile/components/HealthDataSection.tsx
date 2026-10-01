import { useId, useState } from 'react';
import { useHealthSync } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { List, ListRow, Section } from '@/ui';
import { healthStatusKey } from '../domain/healthStatus';
import { DisconnectHealthSheet } from './DisconnectHealthSheet';
import styles from './HealthData.module.css';
import { HealthConnectSheet } from './HealthConnectSheet';

/** Settings entry for connected health data (Health Connect on Android). */
export function HealthDataSection() {
  const { t } = useI18n();
  const { status, syncing } = useHealthSync();
  const { settings, updateSetting } = useSettings();
  const [open, setOpen] = useState<'connection' | 'disconnect' | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const countId = useId();
  const counting = settings.countActivityCalories;

  function toggleCounting() {
    setSaveFailed(false);
    updateSetting('countActivityCalories', !counting).catch(() => {
      setSaveFailed(true);
    });
  }

  return (
    <Section title={t('healthConnect.sectionTitle')} footer={t('healthConnect.sectionFooter')}>
      <List>
        <ListRow
          icon="health"
          title={t('healthConnect.name')}
          value={t(healthStatusKey(status, syncing))}
          onPress={() => {
            setOpen('connection');
          }}
        />
        <ListRow
          title={t('healthConnect.countActivity')}
          subtitle={t('healthConnect.countActivityHint')}
          trailing={
            <span className={styles.switchWrap}>
              <span className={styles.switchState} aria-hidden="true">
                {counting ? t('healthConnect.stateOn') : t('healthConnect.stateOff')}
              </span>
              <button
                type="button"
                role="switch"
                className={styles.switch}
                aria-checked={counting}
                aria-label={t('healthConnect.countActivity')}
                aria-describedby={countId}
                onClick={toggleCounting}
              />
            </span>
          }
        />
      </List>
      <p id={countId} className={styles.countNote}>
        {counting ? t('healthConnect.countActivityOn') : t('healthConnect.countActivityOff')}
      </p>
      {saveFailed ? (
        <p className={styles.countNote} role="alert">
          {t('healthConnect.countActivityFailed')}
        </p>
      ) : null}
      {open === 'connection' ? (
        <HealthConnectSheet
          onClose={() => {
            setOpen(null);
          }}
          onDisconnect={() => {
            setOpen('disconnect');
          }}
        />
      ) : null}
      {open === 'disconnect' ? (
        <DisconnectHealthSheet
          onClose={() => {
            setOpen('connection');
          }}
          onDone={() => {
            setOpen(null);
          }}
        />
      ) : null}
    </Section>
  );
}
