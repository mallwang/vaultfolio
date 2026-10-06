import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseService } from '../database/database.service';
import { DomainKeyringService } from './domain-keyring.service';
import { KeyStoreRepository, type StoredDataKey } from './key-store.repository';
import { LegacyMigrationService } from './legacy-migration.service';

/** Builds and initialises a real keyring over `database`; set the `*_ENCRYPTION_KEY` variables first. */
export function createTestKeyring(database: DatabaseService): DomainKeyringService {
  const store = new KeyStoreRepository(database);
  const keyring = new DomainKeyringService(store, new LegacyMigrationService(database, store));
  keyring.onModuleInit();
  return keyring;
}

/** Keyring over an in-memory key store and no legacy rows, for specs that need no SQLite. */
export function createMemoryKeyring(): DomainKeyringService {
  const keys: StoredDataKey[] = [];
  const store = {
    markLeftoverRunsInterrupted: () => undefined,
    listDataKeys: (domain: string) => keys.filter((k) => k.domain === domain),
    highestVersion: (domain: string) =>
      Math.max(1, ...keys.filter((k) => k.domain === domain).map((k) => k.version)),
    retireCurrent: (domain: string) =>
      keys
        .filter((k) => k.domain === domain && k.status === 'current')
        .forEach((k) => (k.status = 'retired')),
    insertDataKey: (
      domain: string,
      version: number,
      wrappedDek: string,
      kekFingerprint: string,
      status: StoredDataKey['status'],
    ) => keys.push({ domain, version, wrappedDek, kekFingerprint, status }),
  } as unknown as KeyStoreRepository;
  const legacy = { hasLegacyRows: () => false } as unknown as LegacyMigrationService;
  const keyring = new DomainKeyringService(store, legacy);
  keyring.onModuleInit();
  return keyring;
}

export interface TestDatabase {
  database: DatabaseService;
  dispose(): Promise<void>;
}

/** Real SQLite database on a temp file with the full schema. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-encryption-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
  const database = new DatabaseService();
  await database.onModuleInit();
  return {
    database,
    dispose: async () => {
      await database.onModuleDestroy();
      fs.rmSync(tempDir, { recursive: true, force: true });
      delete process.env.DATABASE_PATH;
    },
  };
}
