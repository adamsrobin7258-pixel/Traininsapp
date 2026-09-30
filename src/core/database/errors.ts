export type DatabaseKeyProblem =
  /** An encrypted database exists, but no key is stored (e.g. keystore was reset). */
  | 'missing-key'
  /** The database file cannot be read with any known key. */
  | 'unreadable'
  /** The database opened, but verification says it is not encrypted. */
  | 'not-encrypted';

/**
 * The encrypted database cannot be opened safely. The app must stop here: it never falls
 * back to a new or unencrypted database, and it never modifies the existing file.
 */
export class DatabaseKeyError extends Error {
  constructor(
    readonly problem: DatabaseKeyProblem,
    options?: { cause: unknown },
  ) {
    super(`Encrypted database unavailable: ${problem}`, options);
    this.name = 'DatabaseKeyError';
  }
}
