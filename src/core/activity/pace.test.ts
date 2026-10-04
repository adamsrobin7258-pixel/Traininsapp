import { importedPace, PACE_HEALTH_CONNECT_TYPES, paceSecondsPerKm, sportPace } from './pace';

describe('pace', () => {
  it('is minutes per kilometre from metres and seconds', () => {
    // 5,2 km in 32:00 min → 6:09 min/km (369 s).
    expect(paceSecondsPerKm(5200, 32 * 60)).toBe(369);
    // 10 km in 50 min → 5:00 min/km.
    expect(paceSecondsPerKm(10_000, 50 * 60)).toBe(300);
    // 800 m in 4 min → 5:00 min/km (metres, not kilometres).
    expect(paceSecondsPerKm(800, 4 * 60)).toBe(300);
  });

  it('never divides by zero and never shows implausible values', () => {
    expect(paceSecondsPerKm(0, 1800)).toBeNull();
    expect(paceSecondsPerKm(5000, 0)).toBeNull();
    expect(paceSecondsPerKm(null, 1800)).toBeNull();
    expect(paceSecondsPerKm(5000, null)).toBeNull();
    expect(paceSecondsPerKm(Number.NaN, 1800)).toBeNull();
    expect(paceSecondsPerKm(50, 600)).toBeNull(); // below 100 m
    expect(paceSecondsPerKm(10_000, 10 * 60)).toBeNull(); // 1:00 min/km: faster than possible
    expect(paceSecondsPerKm(1000, 2 * 3600)).toBeNull(); // 120 min/km: a forgotten timer
    expect(paceSecondsPerKm(1000, 120)).toBe(120); // limits are inclusive
    expect(paceSecondsPerKm(1000, 3600)).toBe(3600);
  });

  it('is only given for manual sports on foot', () => {
    expect(sportPace('run', 5200, 1920)).toBe(369);
    expect(sportPace('walk', 4000, 2880)).toBe(720);
    expect(sportPace('hike', 12_000, 3 * 3600)).toBe(900);
    expect(sportPace('cycle', 20_000, 3600)).toBeNull();
    expect(sportPace('swim', 1000, 1800)).toBeNull();
    expect(sportPace('tennis', 3000, 3600)).toBeNull();
    expect(sportPace('unknown-sport', 5000, 1800)).toBeNull();
    expect(sportPace('run', null, 1800)).toBeNull();
  });

  it('is only given for imported types on foot – the types of those manual sports', () => {
    expect([...PACE_HEALTH_CONNECT_TYPES].sort()).toEqual([
      'hiking',
      'running',
      'runningTreadmill',
      'walking',
    ]);
    expect(importedPace('running', 5200, 1920)).toBe(369);
    expect(importedPace('runningTreadmill', 5000, 1500)).toBe(300);
    expect(importedPace('cycling', 20_000, 3600)).toBeNull();
    expect(importedPace('strengthTraining', 500, 3600)).toBeNull();
    expect(importedPace('running', null, 1800)).toBeNull();
  });
});
