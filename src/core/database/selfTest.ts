import type { Clock } from '@/shared/lib/clock';
import { createId } from '@/shared/lib/id';
import { migrations } from './migrations';
import { getSchemaVersion } from './migrator';
import type { DatabaseDriver, DatabaseSecurity } from './types';

/**
 * Storage self-test that users (and we, on real devices) can run from the profile.
 * It proves on the actual device that the encrypted database can be written, read,
 * rolled back and survives an app restart. Only touches the technical `diagnostics` table.
 */
export type SelfTestCheck = 'encryption' | 'writeRead' | 'restart' | 'rollback' | 'schema';

export type SelfTestStatus = 'pass' | 'fail' | 'pending';

export interface SelfTestResult {
  check: SelfTestCheck;
  status: SelfTestStatus;
  /** Machine-readable detail for the UI (e.g. SQLCipher version, ISO date, versions). */
  detail?: string;
}

interface ProbeValue {
  launchId: string;
  at: string;
}

const PROBE_KEY = 'selfTest.probe';
const ROLLBACK_KEY = 'selfTest.rollback';

/** Unique per app process, so "restart" can be told apart from a second run. */
const LAUNCH_ID = createId();

async function readProbe(db: DatabaseDriver, key: string): Promise<ProbeValue | null> {
  const rows = await db.query<{ value: string }>('SELECT value FROM diagnostics WHERE key = ?', [
    key,
  ]);
  const raw = rows[0]?.value;
  if (raw === undefined) return null;
  try {
    return JSON.parse(raw) as ProbeValue;
  } catch {
    return null;
  }
}

async function writeProbe(db: DatabaseDriver, key: string, value: ProbeValue, at: string) {
  await db.run(
    `INSERT INTO diagnostics (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), at],
  );
}

async function guard(
  check: SelfTestCheck,
  run: () => Promise<Omit<SelfTestResult, 'check'>>,
): Promise<SelfTestResult> {
  try {
    return { check, ...(await run()) };
  } catch (error) {
    return { check, status: 'fail', detail: error instanceof Error ? error.message : 'error' };
  }
}

export async function runStorageSelfTest(
  db: DatabaseDriver,
  security: DatabaseSecurity,
  clock: Clock,
  launchId: string = LAUNCH_ID,
): Promise<SelfTestResult[]> {
  const now = clock().toISOString();

  const encryption = await guard('encryption', () =>
    Promise.resolve(
      security.encrypted && security.cipherVersion
        ? { status: 'pass', detail: security.cipherVersion }
        : { status: 'fail', detail: security.outcome },
    ),
  );

  const earlier: { value: ProbeValue | null } = { value: null };
  const writeRead = await guard('writeRead', async () => {
    earlier.value = await readProbe(db, PROBE_KEY);
    const probe = { launchId, at: now };
    await writeProbe(db, PROBE_KEY, probe, now);
    const back = await readProbe(db, PROBE_KEY);
    return back?.launchId === launchId && back.at === now
      ? { status: 'pass' }
      : { status: 'fail', detail: 'mismatch' };
  });

  const restart = await guard('restart', () => {
    const previous = earlier.value;
    if (previous && previous.launchId !== launchId) {
      return Promise.resolve({ status: 'pass', detail: previous.at });
    }
    // Not yet provable: the app has to be closed and started again.
    return Promise.resolve({ status: 'pending' });
  });

  const rollback = await guard('rollback', async () => {
    const intentional = new Error('intentional rollback');
    const outcome = await db
      .transaction(async (tx) => {
        await tx.run('INSERT INTO diagnostics (key, value, updated_at) VALUES (?, ?, ?)', [
          ROLLBACK_KEY,
          '{}',
          now,
        ]);
        throw intentional;
      })
      .catch((error: unknown) => error);
    if (outcome !== intentional) return { status: 'fail', detail: 'unexpected transaction result' };
    const leaked = await readProbe(db, ROLLBACK_KEY);
    await db.run('DELETE FROM diagnostics WHERE key = ?', [ROLLBACK_KEY]);
    return leaked === null ? { status: 'pass' } : { status: 'fail', detail: 'not rolled back' };
  });

  const schema = await guard('schema', async () => {
    const current = await getSchemaVersion(db);
    const expected = migrations.at(-1)?.version ?? 0;
    return {
      status: current === expected ? 'pass' : 'fail',
      detail: `${current}/${expected}`,
    };
  });

  return [encryption, writeRead, restart, rollback, schema];
}
