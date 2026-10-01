import { useState } from 'react';
import {
  IMPORTED_KINDS,
  useHealthSync,
  type ConnectOutcome,
  type HealthStatusView,
} from '@/core/health';
import { useI18n } from '@/core/i18n';
import { HEALTH_DATA_KINDS } from '@/core/platform/health';
import { Button, Icon, List, ListRow, Sheet, type IconName } from '@/ui';
import { healthStatusKey } from '../domain/healthStatus';
import styles from './HealthData.module.css';

const KIND_ICONS = {
  weight: 'scale',
  steps: 'health',
  activeEnergy: 'flame',
  exercise: 'training',
} as const satisfies Record<(typeof HEALTH_DATA_KINDS)[number], IconName>;

/**
 * Health Connect: Kalethra's own explanation first, then – only on the button – the system
 * permission dialog. Once connected: status, last update, manual sync, permissions, disconnect.
 */
export function HealthConnectSheet({
  onClose,
  onDisconnect,
}: {
  onClose: () => void;
  onDisconnect: () => void;
}) {
  const { t } = useI18n();
  const { status, syncing, connect, syncNow, openSettings } = useHealthSync();
  const [connecting, setConnecting] = useState(false);
  const [outcome, setOutcome] = useState<ConnectOutcome['kind'] | null>(null);

  function startConnect() {
    setConnecting(true);
    setOutcome(null);
    connect().then(
      (result) => {
        setOutcome(result.kind);
        setConnecting(false);
      },
      () => {
        setOutcome('failed');
        setConnecting(false);
      },
    );
  }

  return (
    <Sheet title={t('healthConnect.sheetTitle')} onClose={onClose} closeLabel={t('common.close')}>
      {status.state === 'loading' ? null : status.state === 'unsupported' ? (
        <p className={styles.intro}>{t('healthConnect.unsupportedBody')}</p>
      ) : status.state === 'needsInstall' ? (
        <p className={styles.intro}>{t('healthConnect.needsInstallBody')}</p>
      ) : status.state === 'disconnected' ? (
        <>
          <p className={styles.intro}>{t('healthConnect.intro')}</p>
          <ReadsList />
          <Promises />
          {outcome === 'denied' ? (
            <p className={styles.notice} role="status">
              {t('healthConnect.denied')}
            </p>
          ) : null}
          {outcome === 'failed' || outcome === 'unavailable' ? (
            <p className={styles.error} role="alert">
              {t('healthConnect.connectFailed')}
            </p>
          ) : null}
          <div className={styles.actions}>
            <Button fullWidth disabled={connecting} onClick={startConnect}>
              {connecting ? t('healthConnect.connecting') : t('healthConnect.connect')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <ConnectionState status={status} syncing={syncing} />
          <StateNotice status={status} />
          <ReadsList status={status} />
          <div className={styles.actions}>
            <Button
              fullWidth
              disabled={syncing}
              onClick={() => {
                void syncNow().catch(() => undefined);
              }}
            >
              {syncing ? t('healthConnect.syncing') : t('healthConnect.syncNow')}
            </Button>
            <button
              type="button"
              className={styles.link}
              onClick={() => {
                void openSettings().catch(() => undefined);
              }}
            >
              {t('healthConnect.manage')}
            </button>
            <button
              type="button"
              className={`${styles.link} ${styles.danger}`}
              disabled={syncing}
              onClick={onDisconnect}
            >
              {t('healthConnect.disconnect')}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function ConnectionState({ status, syncing }: { status: HealthStatusView; syncing: boolean }) {
  const { t, locale } = useI18n();
  const lastSuccessAt =
    status.state === 'connected' || status.state === 'permissionRequired'
      ? status.lastSuccessAt
      : null;
  const warning =
    status.state === 'permissionRequired' ||
    (status.state === 'connected' && status.lastResult === 'failed');
  return (
    <div
      className={styles.state}
      data-tone={syncing ? 'busy' : warning ? 'warning' : 'ok'}
      role="status"
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.stateText}>
        <span className={styles.stateTitle}>{t(healthStatusKey(status, syncing))}</span>
        <span className={styles.stateDetail}>
          {lastSuccessAt
            ? t('healthConnect.lastSync', {
                date: new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(lastSuccessAt)),
              })
            : t('healthConnect.neverSynced')}
        </span>
      </span>
    </div>
  );
}

function StateNotice({ status }: { status: HealthStatusView }) {
  const { t } = useI18n();
  if (status.state === 'permissionRequired') {
    return <p className={styles.notice}>{t('healthConnect.permissionBody')}</p>;
  }
  if (status.state !== 'connected') return null;
  if (status.lastResult === 'failed') {
    return <p className={styles.notice}>{t('healthConnect.failedBody')}</p>;
  }
  if (status.lastResult === 'unavailable') {
    return <p className={styles.notice}>{t('healthConnect.unavailableBody')}</p>;
  }
  if (status.missing.length > 0) {
    return <p className={styles.notice}>{t('healthConnect.partialBody')}</p>;
  }
  return null;
}

/** The four kinds with what is read; once connected also whether access is granted. */
function ReadsList({ status }: { status?: HealthStatusView }) {
  const { t } = useI18n();
  const missing =
    status?.state === 'permissionRequired'
      ? [...IMPORTED_KINDS]
      : status?.state === 'connected'
        ? status.missing
        : null;
  return (
    <>
      <h3 className={styles.subtitle}>{t('healthConnect.readsTitle')}</h3>
      <List label={t('healthConnect.readsTitle')}>
        {HEALTH_DATA_KINDS.map((kind) => (
          <ListRow
            key={kind}
            icon={KIND_ICONS[kind]}
            title={t(`healthConnect.kinds.${kind}`)}
            subtitle={t(`healthConnect.kindHints.${kind}`)}
            value={
              missing && kind !== 'exercise'
                ? (missing as readonly string[]).includes(kind)
                  ? t('healthConnect.kindMissing')
                  : t('healthConnect.kindActive')
                : undefined
            }
          />
        ))}
      </List>
    </>
  );
}

function Promises() {
  const { t } = useI18n();
  const items = ['readOnly', 'local', 'goals', 'window'] as const;
  return (
    <ul className={styles.promises}>
      {items.map((item) => (
        <li key={item} className={styles.promise}>
          <Icon name="check" size={16} />
          <span>{t(`healthConnect.promises.${item}`)}</span>
        </li>
      ))}
    </ul>
  );
}
