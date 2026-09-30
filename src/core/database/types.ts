/** Values that can be bound to SQL parameters. */
export type SqlValue = string | number | null;

export interface RunResult {
  /** Number of rows changed by the statement. */
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
   * rolls back when it throws. Transactions must not be nested.
   */
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
