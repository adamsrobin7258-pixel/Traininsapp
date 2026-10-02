import { useId, useState } from 'react';
import { useI18n } from '@/core/i18n';
import {
  RECOVERY_STATES,
  useRecovery,
  useRecoveryData,
  type RecoveryEntry,
  type RecoveryInput,
  type RecoveryState,
} from '@/core/recovery';
import { toLocalDateKey } from '@/shared/lib/date';
import styles from './RecoveryCheckIn.module.css';

/**
 * Today's recovery note: how recovered the user feels (tap again to clear) and whether today is
 * a rest day. Saved at once; no text field, so no keyboard. A subjective note for the score,
 * never a medical rating.
 */
export function RecoveryCheckIn() {
  const { t } = useI18n();
  const { save } = useRecovery();
  const today = toLocalDateKey(new Date());
  const data = useRecoveryData((service, profileId) => service.get(profileId, today), [today]);
  const [pending, setPending] = useState<RecoveryEntry | null | undefined>(undefined);
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle');
  const questionId = useId();
  const restHintId = useId();
  const loaded = data.status === 'ready';
  const current = pending !== undefined ? pending : loaded ? data.data : null;

  function store(input: RecoveryInput) {
    setStatus('idle');
    // Shown right away; the stored entry replaces it once saved.
    setPending(
      input.state === null && !input.restDay
        ? null
        : {
            id: current?.id ?? '',
            profileId: current?.profileId ?? '',
            localDate: today,
            createdAt: current?.createdAt ?? '',
            updatedAt: current?.updatedAt ?? '',
            ...input,
          },
    );
    save(today, input).then(
      (entry) => {
        setPending(entry);
        setStatus('saved');
      },
      () => {
        setPending(undefined);
        setStatus('failed');
      },
    );
  }

  function chooseState(state: RecoveryState) {
    store({ state: current?.state === state ? null : state, restDay: current?.restDay ?? false });
  }

  function toggleRestDay() {
    store({ state: current?.state ?? null, restDay: !(current?.restDay ?? false) });
  }

  return (
    <div className={styles.checkIn}>
      <p id={questionId} className={styles.question}>
        {t('health.recovery.question')}
      </p>
      <div className={styles.states} role="group" aria-labelledby={questionId}>
        {RECOVERY_STATES.map((state) => (
          <button
            key={state}
            type="button"
            className={styles.state}
            aria-pressed={current?.state === state}
            disabled={!loaded}
            onClick={() => {
              chooseState(state);
            }}
          >
            {t(`health.recovery.states.${state}`)}
          </button>
        ))}
      </div>
      <button
        type="button"
        role="switch"
        className={styles.restDay}
        aria-checked={current?.restDay ?? false}
        aria-describedby={restHintId}
        disabled={!loaded}
        onClick={toggleRestDay}
      >
        <span>{t('health.recovery.restDay')}</span>
        <span className={styles.toggle} aria-hidden="true" />
      </button>
      <p id={restHintId} className={styles.hint}>
        {t('health.recovery.restDayHint')}
      </p>
      <p className={styles.hint}>
        {t('health.recovery.clearHint')} {t('health.recovery.hint')}
      </p>
      <p className={styles.status} role="status">
        {status === 'saved' ? t('health.recovery.saved') : ''}
      </p>
      {status === 'failed' ? (
        <p className={styles.error} role="alert">
          {t('health.recovery.failed')}
        </p>
      ) : null}
    </div>
  );
}
