import { createTestDatabase, fixedClock } from '@/test/database';
import { resolveLocale, resolveTheme } from './resolve';
import { SettingsRepository } from './settingsRepository';
import { parseSettings, SettingsService } from './settingsService';
import { DEFAULT_SETTINGS } from './types';

async function createService() {
  const db = await createTestDatabase();
  return { db, service: new SettingsService(new SettingsRepository(db, fixedClock())) };
}

describe('SettingsService', () => {
  it('returns defaults when nothing is stored', async () => {
    const { service } = await createService();
    expect(await service.load()).toEqual(DEFAULT_SETTINGS);
  });

  it('persists updates', async () => {
    const { service } = await createService();
    await service.update('theme', 'dark');
    await service.update('language', 'en');
    await service.update('theme', 'light');

    expect(await service.load()).toEqual({
      theme: 'light',
      language: 'en',
      weightUnit: 'kg',
      waterQuickAmountsMl: [250, 500, 750],
      progressionMode: 'normal',
      restTimerSeconds: 90,
    });
  });

  it('rejects invalid values', async () => {
    const { service } = await createService();
    // @ts-expect-error – deliberately invalid input
    await expect(service.update('theme', 'sepia')).rejects.toThrow(/Invalid value/);
  });

  it('stores water quick amounts and rejects implausible ones', async () => {
    const { service } = await createService();
    await service.update('waterQuickAmountsMl', [200, 330]);
    expect((await service.load()).waterQuickAmountsMl).toEqual([200, 330]);
    for (const invalid of [[], [0], [-250], [250.5], [6000], [100, 200, 300, 400, 500]]) {
      await expect(service.update('waterQuickAmountsMl', invalid)).rejects.toThrow(/Invalid value/);
    }
    expect((await service.load()).waterQuickAmountsMl).toEqual([200, 330]);
  });

  it('has no "Aktivitätskalorien anrechnen" any more – it is a versioned target (core/targets)', async () => {
    const { db, service } = await createService();
    // A key left from before migration 15 is ignored, never read as a setting.
    await db.run("INSERT INTO app_settings VALUES ('countActivityCalories', 'true', 'x')");
    expect(await service.load()).toEqual(DEFAULT_SETTINGS);
    expect('countActivityCalories' in (await service.load())).toBe(false);
  });

  it('training: suggestions "Normal" and a 90 s rest timer by default, choices persist', async () => {
    const { db, service } = await createService();
    expect(await service.load()).toMatchObject({ progressionMode: 'normal', restTimerSeconds: 90 });
    await service.update('progressionMode', 'cautious');
    await service.update('restTimerSeconds', 0);
    const restarted = new SettingsService(new SettingsRepository(db, fixedClock()));
    expect(await restarted.load()).toMatchObject({
      progressionMode: 'cautious',
      restTimerSeconds: 0,
    });
    for (const mode of ['off', 'progressive', 'normal'] as const) {
      await service.update('progressionMode', mode);
      expect((await restarted.load()).progressionMode).toBe(mode);
    }
    for (const seconds of [30, 60, 120, 180, 240, 300] as const) {
      await service.update('restTimerSeconds', seconds);
      expect((await restarted.load()).restTimerSeconds).toBe(seconds);
    }
    // @ts-expect-error – deliberately invalid input
    await expect(service.update('progressionMode', 'aggressive')).rejects.toThrow(/Invalid value/);
    // @ts-expect-error – only the offered steps are valid
    await expect(service.update('restTimerSeconds', 45)).rejects.toThrow(/Invalid value/);
  });

  it('ignores corrupt or unknown stored values', async () => {
    const { db, service } = await createService();
    await db.run("INSERT INTO app_settings VALUES ('theme', '\"neon\"', 'x')");
    await db.run("INSERT INTO app_settings VALUES ('language', 'not json', 'x')");
    await db.run("INSERT INTO app_settings VALUES ('legacy', '1', 'x')");

    expect(await service.load()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('parseSettings', () => {
  it('keeps valid values and falls back per key', () => {
    expect(
      parseSettings(
        new Map<string, unknown>([
          ['language', 'de'],
          ['theme', 42],
        ]),
      ),
    ).toEqual({
      theme: 'system',
      language: 'de',
      weightUnit: 'kg',
      waterQuickAmountsMl: [250, 500, 750],
      progressionMode: 'normal',
      restTimerSeconds: 90,
    });
  });
});

describe('resolveTheme', () => {
  it('follows the system only when requested', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('resolveLocale', () => {
  it('uses the device language for "system"', () => {
    expect(resolveLocale('system', ['de-CH', 'en'])).toBe('de');
    expect(resolveLocale('system', ['fr-FR'])).toBe('en');
  });

  it('uses an explicit choice regardless of the device', () => {
    expect(resolveLocale('en', ['de-DE'])).toBe('en');
  });
});
