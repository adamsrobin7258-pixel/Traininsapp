/**
 * The rest timer after a completed set – pure state, driven by timestamps (ms), so a screen
 * that was off or in the background shows the right remaining time when it comes back.
 */
export type RestTimerState =
  | { status: 'idle' }
  | { status: 'running'; endsAt: number }
  | { status: 'paused'; leftMs: number }
  | { status: 'done' };

export const IDLE: RestTimerState = { status: 'idle' };

/** Starts (or restarts) the timer; 0 seconds means no timer at all. */
export function startRest(seconds: number, now: number): RestTimerState {
  return seconds > 0 ? { status: 'running', endsAt: now + seconds * 1000 } : IDLE;
}

export function pauseRest(state: RestTimerState, now: number): RestTimerState {
  return state.status === 'running'
    ? { status: 'paused', leftMs: Math.max(0, state.endsAt - now) }
    : state;
}

export function resumeRest(state: RestTimerState, now: number): RestTimerState {
  return state.status === 'paused' ? { status: 'running', endsAt: now + state.leftMs } : state;
}

/** A running timer whose time is up becomes `done`; everything else stays. */
export function tickRest(state: RestTimerState, now: number): RestTimerState {
  return state.status === 'running' && now >= state.endsAt ? { status: 'done' } : state;
}

/** Whole seconds left (rounded up, so "0:01" shows until the very end). */
export function restSecondsLeft(state: RestTimerState, now: number): number {
  if (state.status === 'running') return Math.max(0, Math.ceil((state.endsAt - now) / 1000));
  if (state.status === 'paused') return Math.ceil(state.leftMs / 1000);
  return 0;
}

/** "1:30", "0:05" – minutes and seconds of the rest time. */
export function formatRestTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
