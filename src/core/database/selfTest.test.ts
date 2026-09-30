import { createTestDatabase, ENCRYPTED_TEST_SECURITY, fixedClock } from '@/test/database';
import { runStorageSelfTest, type SelfTestResult } from './selfTest';

const statusOf = (results: SelfTestResult[]) =>
  Object.fromEntries(results.map((r) => [r.check, r.status]));

describe('runStorageSelfTest', () => {
  it('passes on an encrypted database and asks for a restart on the first run', async () => {
    const db = await createTestDatabase();
    const results = await runStorageSelfTest(db, ENCRYPTED_TEST_SECURITY, fixedClock(), 'launch-1');
    expect(statusOf(results)).toEqual({
      encryption: 'pass',
      writeRead: 'pass',
      restart: 'pending',
      rollback: 'pass',
      schema: 'pass',
    });
    expect(results.find((r) => r.check === 'encryption')?.detail).toBe('4.17.0 test');
  });

  it('confirms persistence across launches', async () => {
    const db = await createTestDatabase();
    await runStorageSelfTest(
      db,
      ENCRYPTED_TEST_SECURITY,
      fixedClock('2026-10-01T07:00:00.000Z'),
      'a',
    );
    const second = await runStorageSelfTest(db, ENCRYPTED_TEST_SECURITY, fixedClock(), 'b');
    expect(second.find((r) => r.check === 'restart')).toEqual({
      check: 'restart',
      status: 'pass',
      detail: '2026-10-01T07:00:00.000Z',
    });
  });

  it('does not count a second run in the same launch as a restart', async () => {
    const db = await createTestDatabase();
    await runStorageSelfTest(db, ENCRYPTED_TEST_SECURITY, fixedClock(), 'same');
    const again = await runStorageSelfTest(db, ENCRYPTED_TEST_SECURITY, fixedClock(), 'same');
    expect(statusOf(again).restart).toBe('pending');
  });

  it('fails the encryption check for an unencrypted database', async () => {
    const db = await createTestDatabase();
    const results = await runStorageSelfTest(
      db,
      { encrypted: false, outcome: 'development-unencrypted', cipherVersion: null },
      fixedClock(),
    );
    expect(results[0]).toEqual({
      check: 'encryption',
      status: 'fail',
      detail: 'development-unencrypted',
    });
  });

  it('leaves no rollback probe behind', async () => {
    const db = await createTestDatabase();
    await runStorageSelfTest(db, ENCRYPTED_TEST_SECURITY, fixedClock());
    const keys = await db.query<{ key: string }>('SELECT key FROM diagnostics ORDER BY key');
    expect(keys.map((k) => k.key)).toEqual(['selfTest.probe']);
  });

  it('reports a failing check instead of throwing', async () => {
    const db = await createTestDatabase();
    await db.execute('DROP TABLE diagnostics');
    const results = await runStorageSelfTest(db, ENCRYPTED_TEST_SECURITY, fixedClock());
    expect(statusOf(results).writeRead).toBe('fail');
  });
});
