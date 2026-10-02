import { useId, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { List, ListRow, Section } from '@/ui';
import styles from './HealthData.module.css';

/**
 * "Aktivitätskalorien anrechnen" – a nutrition goal: adds the active calories of Health Connect
 * and manual activities (each session once, none that is a Kalethra workout) to the day's
 * calorie goal. The stored base goal and the macro goals never change. Saved at once.
 */
export function ActivityCaloriesSection() {
  const { t } = useI18n();
  const { settings, updateSetting } = useSettings();
  const [saveFailed, setSaveFailed] = useState(false);
  const countId = useId();
  const counting = settings.countActivityCalories;

  function toggle() {
    setSaveFailed(false);
    updateSetting('countActivityCalories', !counting).catch(() => {
      setSaveFailed(true);
    });
  }

  return (
    <Section title={t('settings.goals.activityCalories')}>
      <List>
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
                onClick={toggle}
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
    </Section>
  );
}
