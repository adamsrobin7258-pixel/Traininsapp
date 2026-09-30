import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import type { DatabaseDriver, RunResult, SqlExecutor, SqlValue } from '../types';

/**
 * Driver backed by @capacitor-community/sqlite.
 * - Android/iOS: native SQLite database stored in the app sandbox.
 * - Web (development only): jeep-sqlite (sql.js/WASM) persisted in IndexedDB.
 */
export async function openCapacitorSqliteDriver(databaseName: string): Promise<DatabaseDriver> {
  const isWeb = Capacitor.getPlatform() === 'web';
  const sqlite = new SQLiteConnection(CapacitorSQLite);

  if (isWeb) {
    await setupWebStore(sqlite);
  }

  await sqlite.checkConnectionsConsistency();
  const existing = (await sqlite.isConnection(databaseName, false)).result === true;
  const connection = existing
    ? await sqlite.retrieveConnection(databaseName, false)
    : await sqlite.createConnection(databaseName, false, 'no-encryption', 1, false);
  await connection.open();
  await connection.execute('PRAGMA foreign_keys = ON;', false);

  const persist = isWeb ? () => sqlite.saveToStore(databaseName) : () => Promise.resolve();
  return new CapacitorSqliteDriver(connection, persist, async () => {
    await sqlite.closeConnection(databaseName, false);
  });
}

async function setupWebStore(sqlite: SQLiteConnection): Promise<void> {
  const { defineCustomElements } = await import('jeep-sqlite/loader');
  defineCustomElements(window);
  if (!document.querySelector('jeep-sqlite')) {
    const element = document.createElement('jeep-sqlite');
    // The WASM binary is copied to public/assets by scripts/copy-sqlite-wasm.mjs.
    element.setAttribute('wasmpath', 'assets');
    document.body.appendChild(element);
  }
  await customElements.whenDefined('jeep-sqlite');
  await sqlite.initWebStore();
}

function createExecutor(connection: SQLiteDBConnection, inTransaction: boolean): SqlExecutor {
  // The plugin wraps every write in its own transaction unless told otherwise.
  const autoTransaction = !inTransaction;
  return {
    async execute(sql) {
      await connection.execute(sql, autoTransaction);
    },
    async run(sql, params: readonly SqlValue[] = []): Promise<RunResult> {
      const result = await connection.run(sql, [...params], autoTransaction);
      return { changes: result.changes?.changes ?? 0 };
    },
    async query<T extends object>(sql: string, params: readonly SqlValue[] = []) {
      const result = await connection.query(sql, [...params]);
      return (result.values ?? []) as T[];
    },
  };
}

class CapacitorSqliteDriver implements DatabaseDriver {
  private readonly executor: SqlExecutor;
  private readonly txExecutor: SqlExecutor;
  private inTransaction = false;

  constructor(
    private readonly connection: SQLiteDBConnection,
    private readonly persist: () => Promise<void>,
    private readonly onClose: () => Promise<void>,
  ) {
    this.executor = createExecutor(connection, false);
    this.txExecutor = createExecutor(connection, true);
  }

  async execute(sql: string): Promise<void> {
    await this.executor.execute(sql);
    await this.persist();
  }

  async run(sql: string, params?: readonly SqlValue[]): Promise<RunResult> {
    const result = await this.executor.run(sql, params);
    await this.persist();
    return result;
  }

  query<T extends object>(sql: string, params?: readonly SqlValue[]): Promise<T[]> {
    return this.executor.query<T>(sql, params);
  }

  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    if (this.inTransaction) throw new Error('Nested transactions are not supported');
    this.inTransaction = true;
    await this.connection.beginTransaction();
    try {
      const result = await work(this.txExecutor);
      await this.connection.commitTransaction();
      await this.persist();
      return result;
    } catch (error) {
      await this.connection.rollbackTransaction();
      throw error;
    } finally {
      this.inTransaction = false;
    }
  }

  close(): Promise<void> {
    return this.onClose();
  }
}
