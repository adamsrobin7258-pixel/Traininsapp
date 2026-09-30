import initSqlJs, { type Database } from 'sql.js';
import type { DatabaseDriver, RunResult, SqlExecutor, SqlValue } from '../types';

/**
 * In-memory driver based on sql.js. Used by automated tests so that migrations
 * and repositories run against a real SQLite engine without a device.
 */
export async function openSqlJsDriver(): Promise<DatabaseDriver> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON;');
  return new SqlJsDriver(db);
}

/** sql.js is synchronous; report its exceptions as rejections, like a real async driver. */
function settle<T>(work: () => T): Promise<T> {
  try {
    return Promise.resolve(work());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

class SqlJsDriver implements DatabaseDriver {
  private inTransaction = false;

  constructor(private readonly db: Database) {}

  execute(sql: string): Promise<void> {
    return settle(() => {
      this.db.exec(sql);
    });
  }

  run(sql: string, params: readonly SqlValue[] = []): Promise<RunResult> {
    return settle(() => {
      this.db.run(sql, [...params]);
      return { changes: this.db.getRowsModified() };
    });
  }

  query<T extends object>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    return settle(() => {
      const statement = this.db.prepare(sql, [...params]);
      const rows: T[] = [];
      try {
        while (statement.step()) rows.push(statement.getAsObject() as T);
      } finally {
        statement.free();
      }
      return rows;
    });
  }

  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    if (this.inTransaction) throw new Error('Nested transactions are not supported');
    this.inTransaction = true;
    this.db.exec('BEGIN');
    try {
      const result = await work(this);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    } finally {
      this.inTransaction = false;
    }
  }

  close(): Promise<void> {
    this.db.close();
    return Promise.resolve();
  }
}
