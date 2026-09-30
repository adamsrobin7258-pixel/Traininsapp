import {
  generatePassphrase,
  planEncryptedOpen,
  verifyEncrypted,
  type EncryptionPort,
} from './encryption';
import { DatabaseKeyError } from './errors';

interface FakeState {
  secret: string | null;
  exists: boolean;
  /** `true`/`false`, or 'unreadable' when the plugin cannot decide. */
  encrypted: boolean | 'unreadable';
}

function fakePort(initial: FakeState) {
  const state = { ...initial };
  const calls: string[] = [];
  const port: EncryptionPort = {
    isSecretStored: () => Promise.resolve(state.secret !== null),
    setEncryptionSecret: (passphrase) => {
      calls.push('setEncryptionSecret');
      if (state.secret !== null) return Promise.reject(new Error('already set'));
      state.secret = passphrase;
      return Promise.resolve();
    },
    isDatabase: () => Promise.resolve(state.exists),
    isDatabaseEncrypted: () =>
      state.encrypted === 'unreadable'
        ? Promise.reject(new Error('Database unknown'))
        : Promise.resolve(state.encrypted),
  };
  return { port, state, calls };
}

describe('planEncryptedOpen', () => {
  it('creates a key and a new encrypted database on first launch', async () => {
    const { port, state } = fakePort({ secret: null, exists: false, encrypted: false });
    const plan = await planEncryptedOpen(port, 'kalethra', () => 'a'.repeat(64));
    expect(plan).toEqual({ mode: 'secret', outcome: 'created' });
    expect(state.secret).toBe('a'.repeat(64));
  });

  it('encrypts a plaintext database from an older app version', async () => {
    const { port, state } = fakePort({ secret: null, exists: true, encrypted: false });
    const plan = await planEncryptedOpen(port, 'kalethra', () => 'b'.repeat(64));
    expect(plan).toEqual({ mode: 'encryption', outcome: 'encrypted-existing' });
    expect(state.secret).toBe('b'.repeat(64));
  });

  it('reuses the stored key for an existing encrypted database', async () => {
    const { port, calls } = fakePort({ secret: 'k', exists: true, encrypted: true });
    expect(await planEncryptedOpen(port, 'kalethra')).toEqual({
      mode: 'secret',
      outcome: 'opened',
    });
    expect(calls).not.toContain('setEncryptionSecret');
  });

  it('never replaces the key of an encrypted database whose key is missing', async () => {
    const { port, calls } = fakePort({ secret: null, exists: true, encrypted: true });
    await expect(planEncryptedOpen(port, 'kalethra')).rejects.toEqual(
      expect.objectContaining({ name: 'DatabaseKeyError', problem: 'missing-key' }),
    );
    expect(calls).not.toContain('setEncryptionSecret');
  });

  it('stops when the file cannot be read with any known key', async () => {
    const { port, calls } = fakePort({ secret: 'k', exists: true, encrypted: 'unreadable' });
    const error: unknown = await planEncryptedOpen(port, 'kalethra').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DatabaseKeyError);
    expect((error as DatabaseKeyError).problem).toBe('unreadable');
    expect(calls).toEqual([]);
  });

  it('only ever plans encrypted open modes', async () => {
    const scenarios: FakeState[] = [
      { secret: null, exists: false, encrypted: false },
      { secret: null, exists: true, encrypted: false },
      { secret: 'k', exists: false, encrypted: false },
      { secret: 'k', exists: true, encrypted: false },
      { secret: 'k', exists: true, encrypted: true },
    ];
    for (const scenario of scenarios) {
      const { mode } = await planEncryptedOpen(fakePort(scenario).port, 'kalethra');
      expect(['secret', 'encryption']).toContain(mode);
    }
  });
});

describe('verifyEncrypted', () => {
  it('accepts an encrypted file', async () => {
    const { port } = fakePort({ secret: 'k', exists: true, encrypted: true });
    await expect(verifyEncrypted(port, 'kalethra')).resolves.toBeUndefined();
  });

  it('rejects a plaintext file instead of continuing', async () => {
    const { port } = fakePort({ secret: 'k', exists: true, encrypted: false });
    await expect(verifyEncrypted(port, 'kalethra')).rejects.toEqual(
      expect.objectContaining({ problem: 'not-encrypted' }),
    );
  });
});

describe('generatePassphrase', () => {
  it('produces 256 bits as 64 hex characters from the CSPRNG', () => {
    const passphrase = generatePassphrase();
    expect(passphrase).toMatch(/^[0-9a-f]{64}$/);
    expect(generatePassphrase()).not.toBe(passphrase);
  });

  it('encodes the random bytes exactly', () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, i) => i * 8);
    expect(generatePassphrase(() => bytes)).toBe(
      Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''),
    );
  });

  it('rejects a short random source', () => {
    expect(() => generatePassphrase(() => new Uint8Array(16))).toThrow(/wrong length/);
  });
});
