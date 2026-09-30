import { DatabaseKeyError } from './errors';

/**
 * Key management for the encrypted SQLite database (SQLCipher via @capacitor-community/sqlite).
 *
 * The passphrase is generated once from the platform's CSPRNG and handed to the plugin,
 * which stores it in secure storage (Android: EncryptedSharedPreferences backed by the
 * Android Keystore, iOS: Keychain). It is never written anywhere by this app.
 * Details and threat model: docs/PRIVACY.md.
 */

/** The subset of the SQLite plugin needed to decide how to open the database. */
export interface EncryptionPort {
  isSecretStored(): Promise<boolean>;
  setEncryptionSecret(passphrase: string): Promise<void>;
  isDatabase(name: string): Promise<boolean>;
  /** Throws if the file exists but cannot be read with any known key. */
  isDatabaseEncrypted(name: string): Promise<boolean>;
}

/** Plugin open modes: `secret` opens/creates with the stored key, `encryption` converts plaintext. */
export type EncryptedOpenMode = 'secret' | 'encryption';

export type EncryptionOutcome =
  | 'created' // first launch: new encrypted database
  | 'opened' // existing encrypted database
  | 'encrypted-existing'; // plaintext database from an older version was encrypted in place

export interface EncryptedOpenPlan {
  mode: EncryptedOpenMode;
  outcome: EncryptionOutcome;
}

const PASSPHRASE_BYTES = 32; // 256 bit

/** 256-bit random passphrase as hex, from the platform CSPRNG. No custom cryptography. */
export function generatePassphrase(
  randomBytes: (length: number) => Uint8Array = (length) =>
    crypto.getRandomValues(new Uint8Array(length)),
): string {
  const bytes = randomBytes(PASSPHRASE_BYTES);
  if (bytes.length !== PASSPHRASE_BYTES) throw new Error('Random source returned wrong length');
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readEncryptionState(port: EncryptionPort, name: string): Promise<boolean> {
  try {
    return await port.isDatabaseEncrypted(name);
  } catch (cause) {
    throw new DatabaseKeyError('unreadable', { cause });
  }
}

/**
 * Decides how to open the database and makes sure a key exists. Never returns a plan that
 * would open the database without encryption.
 */
export async function planEncryptedOpen(
  port: EncryptionPort,
  name: string,
  createPassphrase: () => string = generatePassphrase,
): Promise<EncryptedOpenPlan> {
  const exists = await port.isDatabase(name);
  const encrypted = exists ? await readEncryptionState(port, name) : false;

  if (!(await port.isSecretStored())) {
    // An encrypted file without a stored key can never be opened again. Do not touch it.
    if (encrypted) throw new DatabaseKeyError('missing-key');
    await port.setEncryptionSecret(createPassphrase());
  }

  if (!exists) return { mode: 'secret', outcome: 'created' };
  return encrypted
    ? { mode: 'secret', outcome: 'opened' }
    : { mode: 'encryption', outcome: 'encrypted-existing' };
}

/** Called after opening: the file on disk must now be encrypted. */
export async function verifyEncrypted(port: EncryptionPort, name: string): Promise<void> {
  if (!(await readEncryptionState(port, name))) throw new DatabaseKeyError('not-encrypted');
}
