import { createTestDatabase, fixedClock } from '@/test/database';
import { ProfileRepository } from './profileRepository';
import { getInitials, normalizeDisplayName, ProfileService } from './profileService';

async function createService(clockIso?: string) {
  const db = await createTestDatabase();
  const repository = new ProfileRepository(db);
  return { db, repository, service: new ProfileService(repository, fixedClock(clockIso)) };
}

describe('ProfileService', () => {
  it('creates a local profile on first launch and reuses it afterwards', async () => {
    const { db, service } = await createService();

    const first = await service.ensureLocalProfile();
    const second = await service.ensureLocalProfile();

    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toEqual(first);
    expect(first.displayName).toBeNull();
    expect(await db.query('SELECT id FROM profiles')).toHaveLength(1);
  });

  it('renames the profile and stores the normalized name', async () => {
    const { repository, service } = await createService();
    const profile = await service.ensureLocalProfile();

    const renamed = await service.rename(profile, '  Anna   Maria  ');

    expect(renamed.displayName).toBe('Anna Maria');
    expect((await repository.findFirstActive())?.displayName).toBe('Anna Maria');
  });

  it('clears the name for blank input', async () => {
    const { service } = await createService();
    const named = await service.rename(await service.ensureLocalProfile(), 'Anna');
    expect((await service.rename(named, '   ')).displayName).toBeNull();
  });

  it('marks synced records as pending when they change', async () => {
    const { db, service } = await createService();
    const profile = await service.ensureLocalProfile();
    await db.run("UPDATE profiles SET sync_state = 'synced'");

    await service.rename(profile, 'Ben');

    expect(await db.query('SELECT sync_state FROM profiles')).toEqual([{ sync_state: 'pending' }]);
  });
});

describe('normalizeDisplayName', () => {
  it('limits the length to 40 characters', () => {
    expect(normalizeDisplayName('x'.repeat(60))).toHaveLength(40);
  });
});

describe('getInitials', () => {
  it.each([
    [null, ''],
    ['anna', 'A'],
    ['Anna Maria Schmidt', 'AS'],
    ['Élodie Ødegaard', 'ÉØ'],
  ])('%s -> %s', (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });
});
