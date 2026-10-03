import {
  formatRestTime,
  IDLE,
  pauseRest,
  restSecondsLeft,
  resumeRest,
  startRest,
  tickRest,
} from './restTimer';

describe('rest timer', () => {
  it('0 seconds: no timer', () => {
    expect(startRest(0, 1000)).toBe(IDLE);
  });

  it('30 and 60 seconds: counts down from the start and ends exactly at zero', () => {
    const thirty = startRest(30, 0);
    expect(restSecondsLeft(thirty, 0)).toBe(30);
    expect(restSecondsLeft(thirty, 29_001)).toBe(1);
    expect(tickRest(thirty, 29_999)).toBe(thirty);
    expect(tickRest(thirty, 30_000)).toEqual({ status: 'done' });
    const sixty = startRest(60, 5_000);
    expect(restSecondsLeft(sixty, 5_000)).toBe(60);
    expect(tickRest(sixty, 65_000)).toEqual({ status: 'done' });
  });

  it('pause keeps the remaining time, resume continues from there', () => {
    const paused = pauseRest(startRest(60, 0), 20_000);
    expect(paused).toEqual({ status: 'paused', leftMs: 40_000 });
    // Time passing while paused changes nothing.
    expect(restSecondsLeft(paused, 500_000)).toBe(40);
    expect(tickRest(paused, 500_000)).toBe(paused);
    const resumed = resumeRest(paused, 100_000);
    expect(restSecondsLeft(resumed, 100_000)).toBe(40);
    expect(tickRest(resumed, 140_000)).toEqual({ status: 'done' });
  });

  it('a screen that was off shows the right time when it comes back', () => {
    const running = startRest(90, 0);
    expect(restSecondsLeft(running, 75_000)).toBe(15);
    expect(tickRest(running, 600_000)).toEqual({ status: 'done' });
  });

  it('formats minutes and seconds', () => {
    expect(formatRestTime(90)).toBe('1:30');
    expect(formatRestTime(5)).toBe('0:05');
    expect(formatRestTime(300)).toBe('5:00');
  });
});
