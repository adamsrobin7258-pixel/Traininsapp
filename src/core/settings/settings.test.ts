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

    expect(await service.load()).toEqual({ theme: 'light', language: 'en', weightUnit: 'kg' });
  });

  it('rejects invalid values', async () => {
    const { service } = await createService();
    // @ts-expect-error – deliberately invalid input
    await expect(service.update('theme', 'sepia')).rejects.toThrow(/Invalid value/);
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
