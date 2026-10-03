import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '@/core/i18n';
import { notifyHaptic } from '@/core/platform';
import { Icon, registerBackHandler } from '@/ui';
import {
  formatRestTime,
  IDLE,
  pauseRest,
  restSecondsLeft,
  resumeRest,
  startRest,
  tickRest,
  type RestTimerState,
} from '../domain/restTimer';
import { RestTimerContext } from '../hooks/useRestTimer';
import styles from './RestTimer.module.css';

/**
 * Provides the rest timer to the sets of the workout in progress and shows it as a small bar
 * above the tab bar. It never blocks input: every set stays reachable, the timer can be paused,
 * resumed or skipped, and system back closes it first. With 0 seconds nothing is shown.
 * When the rest is over, a quiet notice and – on the device – a short vibration follow.
 */
export function RestTimerProvider({ seconds, children }: { seconds: number; children: ReactNode }) {
  const [state, setState] = useState<RestTimerState>(IDLE);
  const start = useCallback(() => {
    setState(startRest(seconds, Date.now()));
  }, [seconds]);
  const api = useMemo(() => ({ start }), [start]);
  return (
    <RestTimerContext.Provider value={api}>
      {children}
      {state.status !== 'idle' ? (
        <>
          <div className={styles.spacer} aria-hidden="true" />
          <RestTimerBar state={state} onChange={setState} />
        </>
      ) : null}
    </RestTimerContext.Provider>
  );
}

function RestTimerBar({
  state,
  onChange,
}: {
  state: RestTimerState;
  onChange: (next: RestTimerState) => void;
}) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());

  // One tick per second while running; the end is detected from the timestamp.
  useEffect(() => {
    if (state.status !== 'running') return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, [state.status]);

  useEffect(() => {
    const next = tickRest(state, now);
    if (next !== state) {
      onChange(next);
      notifyHaptic();
    }
  }, [state, now, onChange]);

  // System back closes the timer first, then leaves the workout.
  useEffect(
    () =>
      registerBackHandler(() => {
        onChange(IDLE);
      }),
    [onChange],
  );

  const time = formatRestTime(restSecondsLeft(state, now));
  if (state.status === 'done') {
    return (
      <div className={styles.bar} data-status="done" role="status">
        <Icon name="timer" size={20} />
        <span className={styles.text}>{t('training.workout.rest.done')}</span>
        <button
          type="button"
          className={styles.action}
          aria-label={t('training.workout.rest.dismiss')}
          onClick={() => {
            onChange(IDLE);
          }}
        >
          <Icon name="close" size={18} />
        </button>
      </div>
    );
  }
  const paused = state.status === 'paused';
  return (
    <div
      className={styles.bar}
      data-status={state.status}
      role="timer"
      aria-label={t('training.workout.rest.label')}
    >
      <Icon name="timer" size={20} />
      <span className={styles.text}>
        {paused
          ? t('training.workout.rest.paused', { time })
          : t('training.workout.rest.remaining', { time })}
      </span>
      <button
        type="button"
        className={styles.action}
        onClick={() => {
          const at = Date.now();
          setNow(at);
          onChange(paused ? resumeRest(state, at) : pauseRest(state, at));
        }}
      >
        {paused ? t('training.workout.rest.resume') : t('training.workout.rest.pause')}
      </button>
      <button
        type="button"
        className={styles.action}
        onClick={() => {
          onChange(IDLE);
        }}
      >
        {t('training.workout.rest.skip')}
      </button>
    </div>
  );
}
