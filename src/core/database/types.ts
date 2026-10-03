/** Values that can be bound to SQL parameters. */
export type SqlValue = string | number | null;

export interface RunResult {
  /**
   * Number of rows changed. The native plugin reports `total_changes()` before and after, so
   * rows removed or cleared by foreign keys (ON DELETE CASCADE / SET NULL) count too; sql.js
   * reports only the statement's own rows. Check `> 0` to know whether a row was affected.
   */
  changes: number;
}

/**
 * Minimal SQL executor. Everything above the driver layer (migrations, repositories)
 * only depends on this interface, never on a concrete SQLite implementation.
 */
export interface SqlExecutor {
  /** Executes one or more statements without parameters (e.g. DDL in migrations). */
  execute(sql: string): Promise<void>;
  /** Executes a single statement with bound parameters. */
  run(sql: string, params?: readonly SqlValue[]): Promise<RunResult>;
  /** Runs a query and returns all rows as plain objects. */
  query<T extends object>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
}

/** A database connection. Implemented once per platform in ./drivers. */
export interface DatabaseDriver extends SqlExecutor {
  /**
   * Runs `work` inside a transaction. Commits when the callback resolves and
   * rolls back when it throws. Calls are serialised per connection (see serialize.ts); transactions must not be nested.
   */
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** How the local database is protected. Shown to the user and checked by the self-test. */
export interface DatabaseSecurity {
  /** True only when the native database was opened with the stored key and verified. */
  encrypted: boolean;
  outcome: 'created' | 'opened' | 'encrypted-existing' | 'development-unencrypted';
  /** SQLCipher version reported by the database, `null` in the browser. */
  cipherVersion: string | null;
}

export interface OpenedDatabase {
  driver: DatabaseDriver;
  security: DatabaseSecurity;
}
