import { useId, useState } from 'react';
import { useHealthSync } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { Button, Sheet } from '@/ui';
import styles from './HealthData.module.css';

/** Confirms disconnecting; deleting the imported data is pre-selected and can be unticked. */
export function DisconnectHealthSheet({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const { disconnect } = useHealthSync();
  const hintId = useId();
  const labelId = useId();
  const [deleteImported, setDeleteImported] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function confirm() {
    setBusy(true);
    setFailed(false);
    disconnect(deleteImported).then(onDone, () => {
      setFailed(true);
      setBusy(false);
    });
  }

  return (
    <Sheet
      title={t('healthConnect.disconnectTitle')}
      onClose={onClose}
      closeLabel={t('common.close')}
    >
      <p className={styles.intro}>{t('healthConnect.disconnectBody')}</p>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={deleteImported}
          aria-labelledby={labelId}
          aria-describedby={hintId}
          onChange={(event) => {
            setDeleteImported(event.target.checked);
          }}
        />
        <span className={styles.checkText}>
          <span id={labelId}>{t('healthConnect.deleteImported')}</span>
          <span id={hintId} className={styles.checkHint}>
            {t('healthConnect.deleteImportedHint')}
          </span>
        </span>
      </label>
      {failed ? (
        <p className={styles.error} role="alert">
          {t('healthConnect.disconnectFailed')}
        </p>
      ) : null}
      <div className={styles.buttons}>
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="destructive" disabled={busy} onClick={confirm}>
          {t('healthConnect.disconnectConfirm')}
        </Button>
      </div>
    </Sheet>
  );
}
