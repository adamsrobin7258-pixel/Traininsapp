import { useEffect, useId, useState } from 'react';
import { useHealthExport, useHealthSync, type EnableResult } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { onAppForeground } from '@/core/platform';
import { List, ListRow, Section } from '@/ui';
import styles from './HealthData.module.css';

/**
 * Einstellungen → App → Health Connect: the optional export of Kalethra's own workouts and
 * activities. Off by default; on only after Health Connect granted the write permission. Shown
 * only where Health Connect exists (Android) – never on iOS or the web.
 */
export function HealthExportSection() {
  const { t } = useI18n();
  const { state, enable, disable, refresh } = useHealthExport();
  const { openSettings } = useHealthSync();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<EnableResult | 'failed' | null>(null);
  const hintId = useId();

  // Back from Health Connect (permissions changed there): check again.
  useEffect(() => onAppForeground(() => void refresh()), [refresh]);

  if ('loading' in state) return null;
  if (state.access === 'unsupported' && !state.enabled) return null;

  const on = state.enabled;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      if (on) await disable();
      else {
        const result = await enable();
        if (result !== 'enabled') setNote(result);
      }
    } catch {
      setNote('failed');
    } finally {
      setBusy(false);
    }
  }

  const status = !on
    ? null
    : state.access === 'granted'
      ? t('healthExport.status.connected')
      : state.access === 'missing'
        ? t('healthExport.status.permissionRequired')
        : state.access === 'needsInstall'
          ? t('healthExport.status.needsInstall')
          : t('healthExport.status.unavailable');

  return (
    <Section title={t('healthExport.sectionTitle')} footer={t('healthExport.footer')}>
      <List>
        <ListRow
          title={t('healthExport.toggle')}
          subtitle={t('healthExport.description')}
          trailing={
            <span className={styles.switchWrap}>
              <span className={styles.switchState} aria-hidden="true">
                {on ? t('healthConnect.stateOn') : t('healthConnect.stateOff')}
              </span>
              <button
                type="button"
                role="switch"
                className={styles.switch}
                aria-checked={on}
                aria-busy={busy}
                aria-label={t('healthExport.toggle')}
                aria-describedby={hintId}
                disabled={busy}
                onClick={() => void toggle()}
              />
            </span>
          }
        />
        {status ? <ListRow title={t('healthExport.statusLabel')} value={status} /> : null}
        {on && state.access === 'missing' ? (
          <ListRow
            title={t('healthExport.grant')}
            action
            onPress={() => {
              setBusy(true);
              enable()
                .then((result) => {
                  setNote(result === 'enabled' ? null : result);
                })
                .catch(() => {
                  setNote('failed');
                })
                .finally(() => {
                  setBusy(false);
                });
            }}
          />
        ) : null}
        {on ? (
          <ListRow
            title={t('healthExport.manage')}
            onPress={() => {
              openSettings().catch(() => undefined);
            }}
          />
        ) : null}
      </List>
      <p id={hintId} className={styles.countNote} role="status">
        {note === 'denied'
          ? t('healthExport.denied')
          : note === 'needsInstall'
            ? t('healthExport.needsInstall')
            : note === 'unsupported' || note === 'failed'
              ? t('healthExport.unavailable')
              : on
                ? t('healthExport.onNote')
                : t('healthExport.offNote')}
      </p>
    </Section>
  );
}
