import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { planEncryptedOpen, verifyEncrypted, type EncryptionPort } from '../encryption';
import { serialize } from '../serialize';
import type {
  DatabaseDriver,
  DatabaseSecurity,
  OpenedDatabase,
  RunResult,
  SqlExecutor,
  SqlValue,
} from '../types';

/**
 * Driver backed by @capacitor-community/sqlite.
 * - Android/iOS: native SQLCipher database, always encrypted (see ../encryption.ts).
 * - Web (development only): jeep-sqlite (sql.js/WASM) in IndexedDB, NOT encrypted.
 */
export async function openCapacitorSqliteDriver(databaseName: string): Promise<OpenedDatabase> {
  const isWeb = Capacitor.getPlatform() === 'web';
  const sqlite = new SQLiteConnection(CapacitorSQLite);

  if (isWeb) {
    await setupWebStore(sqlite);
  }

  await sqlite.checkConnectionsConsistency();
  const existing = (await sqlite.isConnection(databaseName, false)).result === true;

  const port = createEncryptionPort(sqlite);
  let connection: SQLiteDBConnection;
  let outcome: DatabaseSecurity['outcome'];
  if (isWeb) {
    outcome = 'development-unencrypted';
    connection = existing
      ? await sqlite.retrieveConnection(databaseName, false)
      : await sqlite.createConnection(databaseName, false, 'no-encryption', 1, false);
  } else if (existing) {
    // Same process, e.g. after "retry" on the startup error screen; verified below.
    outcome = 'opened';
    connection = await sqlite.retrieveConnection(databaseName, false);
  } else {
    const plan = await planEncryptedOpen(port, databaseName);
    outcome = plan.outcome;
    connection = await sqlite.createConnection(databaseName, true, plan.mode, 1, false);
  }
  await connection.open();

  if (!isWeb) {
    await verifyEncrypted(port, databaseName);
  }
  await connection.execute('PRAGMA foreign_keys = ON;', false);

  const persist = isWeb ? () => sqlite.saveToStore(databaseName) : () => Promise.resolve();
  const driver = serialize(
    new CapacitorSqliteDriver(connection, persist, async () => {
      await sqlite.closeConnection(databaseName, false);
    }),
  );
  const security: DatabaseSecurity = {
    encrypted: !isWeb,
    outcome,
    cipherVersion: isWeb ? null : await readCipherVersion(driver),
  };
  return { driver, security };
}

function createEncryptionPort(sqlite: SQLiteConnection): EncryptionPort {
  return {
    isSecretStored: async () => (await sqlite.isSecretStored()).result === true,
    setEncryptionSecret: (passphrase) => sqlite.setEncryptionSecret(passphrase),
    isDatabase: async (name) => (await sqlite.isDatabase(name)).result === true,
    isDatabaseEncrypted: async (name) => (await sqlite.isDatabaseEncrypted(name)).result === true,
  };
}

async function readCipherVersion(driver: DatabaseDriver): Promise<string | null> {
  const rows = await driver.query<{ cipher_version?: string }>('PRAGMA cipher_version');
  return rows[0]?.cipher_version ?? null;
}

async function setupWebStore(sqlite: SQLiteConnection): Promise<void> {
  const { defineCustomElements } = await import('jeep-sqlite/loader');
  defineCustomElements(window);
  if (!document.querySelector('jeep-sqlite')) {
    const element = document.createElement('jeep-sqlite');
    // The WASM binary is copied to public/assets by scripts/copy-sqlite-wasm.mjs. Absolute
    // path: a relative one breaks when the app is reloaded on a nested route.
    element.setAttribute('wasmpath', `${import.meta.env.BASE_URL}assets`);
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
