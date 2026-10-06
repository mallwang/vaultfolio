import { randomBytes } from 'node:crypto';
import { Keyring } from '@vaultfolio/encryption';
import { encryptField } from '../shared/field-crypto';
import { rowAad } from './domain-encryption.registry';
import { createTestDatabase, type TestDatabase } from './encryption.testing';
import { KeyStoreRepository } from './key-store.repository';
import { LegacyMigrationService } from './legacy-migration.service';

const MASTER = randomBytes(32);

describe('LegacyMigrationService', () => {
  let db: TestDatabase;
  let store: KeyStoreRepository;
  let service: LegacyMigrationService;

  beforeEach(async () => {
    db = await createTestDatabase();
    store = new KeyStoreRepository(db.database);
    service = new LegacyMigrationService(db.database, store);
  });

  afterEach(() => db.dispose());

  function insertLegacy(id: string, key = MASTER): void {
    db.database.querySync(
      `INSERT INTO wealth_snapshots (id, owner_id, snapshot_date, payload_enc, key_version, created_at, updated_at)
       VALUES ($1, 'u1', $2, $3, 1, 'x', 'x')`,
      [
        id,
        `2026-01-${id.padStart(2, '0')}`,
        encryptField(key, rowAad('wealth_snapshots', id, 'u1'), { marker: id }),
      ],
    );
  }

  const ringWithDataKey = (): Keyring => {
    const ring = new Keyring();
    ring.addDataKey(2, randomBytes(32), true);
    ring.setLegacyKey(MASTER);
    return ring;
  };

  it('detects legacy rows only for v1 ciphertext', () => {
    expect(service.hasLegacyRows('wealth')).toBe(false);
    insertLegacy('1');
    expect(service.hasLegacyRows('wealth')).toBe(true);
    expect(service.hasLegacyRows('earnings')).toBe(false);
  });

  it('proves the legacy key from candidates and rejects wrong ones without writing', () => {
    insertLegacy('1');
    expect(service.proveLegacyKey('wealth', [randomBytes(32), MASTER])).toEqual(MASTER);
    expect(service.proveLegacyKey('wealth', [randomBytes(32)])).toBeNull();
    expect(service.proveLegacyKey('earnings', [MASTER])).toBeNull();
    expect(store.history(undefined, 10)).toEqual([]);
  });

  it('migrates every v1 row onto the data key and records a run', () => {
    for (let i = 1; i <= 3; i++) insertLegacy(String(i));
    const ring = ringWithDataKey();
    service.migrate('wealth', ring);

    expect(store.countRowsPerVersion('wealth')).toEqual({ '2': 3 });
    const [row] = db.database.querySync<{ payload_enc: string; key_version: number }>(
      "SELECT payload_enc, key_version FROM wealth_snapshots WHERE id = '1'",
    );
    expect(row.key_version).toBe(2);
    expect(ring.decrypt(rowAad('wealth_snapshots', '1', 'u1'), row.payload_enc)).toEqual({
      marker: '1',
    });
    expect(store.history('wealth', 5)[0]).toMatchObject({
      kind: 'LEGACY_MIGRATION',
      status: 'SUCCEEDED',
      triggeredByEmail: null,
      recordsTotal: 3,
      recordsDone: 3,
      fromVersion: 1,
      toVersion: 2,
    });
  });

  it('is idempotent and trivially complete for an empty domain', () => {
    const ring = ringWithDataKey();
    service.migrate('wealth', ring);
    insertLegacy('1');
    service.migrate('wealth', ring);
    service.migrate('wealth', ring);
    expect(store.countRowsPerVersion('wealth')).toEqual({ '2': 1 });
    expect(store.history('wealth', 10).every((r) => r.status === 'SUCCEEDED')).toBe(true);
  });

  it('resumes after a partial migration: rows already on v2 are left alone', () => {
    insertLegacy('1');
    insertLegacy('2');
    const ring = ringWithDataKey();
    store.reencryptBatch('wealth', ring, 1);
    expect(store.countRowsPerVersion('wealth')).toEqual({ '1': 1, '2': 1 });
    service.migrate('wealth', ring);
    expect(store.countRowsPerVersion('wealth')).toEqual({ '2': 2 });
  });

  it('fails the run and leaves every row untouched when a row cannot be decrypted', () => {
    insertLegacy('1');
    insertLegacy('2', randomBytes(32));
    const ring = ringWithDataKey();
    expect(() => service.migrate('wealth', ring)).toThrow();
    expect(store.countRowsPerVersion('wealth')).toEqual({ '1': 2 });
    expect(store.history('wealth', 5)[0]).toMatchObject({
      status: 'FAILED',
      errorCode: 'DB_ERROR',
    });
  });
});
