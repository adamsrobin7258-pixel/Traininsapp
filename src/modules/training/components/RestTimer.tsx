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
import { useRestTimerState } from '../hooks/restTimerStore';
import { RestTimerContext } from '../hooks/useRestTimer';
import styles from './RestTimer.module.css';

/**
 * Provides the rest timer to the sets of the workout in progress and shows it as one slim line
 * at the bottom (the workout has no tab bar): label, remaining time, pause/resume and skip. It never blocks input: every set stays reachable, the timer can be paused,
 * resumed or skipped, and system back closes it first. With 0 seconds nothing is shown.
 * When the rest is over, a quiet notice and – on the device – a short vibration follow.
 * The state belongs to the workout, not to the screen: back and resume keep the rest running.
 */
export function RestTimerProvider({
  workoutId,
  seconds,
  children,
}: {
  workoutId: string;
  seconds: number;
  children: ReactNode;
}) {
  const [state, setState] = useRestTimerState(workoutId);
  const start = useCallback(() => {
    setState(startRest(seconds, Date.now()));
  }, [seconds, setState]);
  const api = useMemo(() => ({ start }), [start]);
  return (
    <RestTimerContext.Provider value={api}>
      {/* `data-rest` lets content keep clear of the bar (e.g. a sticky action above it). */}
      <div data-rest={state.status !== 'idle'}>{children}</div>
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
        <span className={styles.label} data-done="true">
          {t('training.workout.rest.done')}
        </span>
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
      <span className={styles.label}>
        {paused ? t('training.workout.rest.pausedLabel') : t('training.workout.rest.label')}
      </span>
      <span className={styles.time}>{time}</span>
      <button
        type="button"
        className={styles.action}
        aria-label={paused ? t('training.workout.rest.resume') : t('training.workout.rest.pause')}
        onClick={() => {
          const at = Date.now();
          setNow(at);
          onChange(paused ? resumeRest(state, at) : pauseRest(state, at));
        }}
      >
        <Icon name={paused ? 'play' : 'pause'} size={20} />
      </button>
      <button
        type="button"
        className={styles.action}
        aria-label={t('training.workout.rest.skip')}
        onClick={() => {
          onChange(IDLE);
        }}
      >
        <Icon name="skip" size={20} />
      </button>
    </div>
  );
}
