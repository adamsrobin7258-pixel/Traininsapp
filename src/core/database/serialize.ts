import type { DatabaseDriver, RunResult, SqlExecutor, SqlValue } from './types';

/**
 * Serialises all operations on one connection.
 *
 * SQLite connections have a single transaction scope: a statement issued by another caller
 * while a transaction is open would silently become part of it (and be rolled back with it),
 * and a second BEGIN fails. UI events can overlap (an input saves on blur while a button click
 * starts another change), so every call waits for the previous one to finish. Code inside a
 * transaction must use the `tx` executor it receives; calling the driver itself from inside
 * `work` would wait for the transaction and never complete.
 */
export function serialize(driver: DatabaseDriver): DatabaseDriver {
  let tail: Promise<unknown> = Promise.resolve();

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation, operation);
    tail = result.catch(() => undefined);
    return result;
  }

  return {
    execute: (sql: string) => enqueue(() => driver.execute(sql)),
    run: (sql: string, params?: readonly SqlValue[]): Promise<RunResult> =>
      enqueue(() => driver.run(sql, params)),
    query: <T extends object>(sql: string, params?: readonly SqlValue[]) =>
      enqueue(() => driver.query<T>(sql, params)),
    transaction: <T>(work: (tx: SqlExecutor) => Promise<T>) =>
      enqueue(() => driver.transaction(work)),
    close: () => enqueue(() => driver.close()),
  };
}
