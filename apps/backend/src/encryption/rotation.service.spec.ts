import { randomBytes } from 'node:crypto';
import { rowAad } from './domain-encryption.registry';
import { DomainKeyringService } from './domain-keyring.service';
import { createTestDatabase, createTestKeyring, type TestDatabase } from './encryption.testing';
import {
  EncryptionConfirmationMismatchException,
  EncryptionDomainNotReadyException,
  EncryptionKeyInUseException,
  EncryptionKeyNotRetiredException,
  EncryptionOperationRunningException,
} from './encryption.exceptions';
import { KeyStoreRepository } from './key-store.repository';
import { RotationService } from './rotation.service';

const key = () => randomBytes(32).toString('base64');
const ENV = ['ENCRYPTION_KEY', 'ENCRYPTION_KEY_PREVIOUS'];

describe('RotationService', () => {
  let db: TestDatabase;
  let store: KeyStoreRepository;
  let ACTOR: { userId: string; email: string | null };

  beforeEach(async () => {
    db = await createTestDatabase();
    store = new KeyStoreRepository(db.database);
    db.database.querySync(
      "INSERT INTO users (id, email, display_name, password_hash, role) VALUES ('admin-1', 'admin@example.com', 'Admin', 'x', 'ADMIN')",
    );
    ACTOR = { userId: 'admin-1', email: 'admin@example.com' };
  });

  afterEach(async () => {
    ENV.forEach((name) => delete process.env[name]);
    await db.dispose();
  });

  function boot(
    current?: string,
    previous?: string,
  ): { keyring: DomainKeyringService; rotation: RotationService } {
    ENV.forEach((name) => delete process.env[name]);
    if (current) process.env.ENCRYPTION_KEY = current;
    if (previous) process.env.ENCRYPTION_KEY_PREVIOUS = previous;
    const keyring = createTestKeyring(db.database);
    return { keyring, rotation: new RotationService(keyring, store, db.database) };
  }

  function addSnapshots(keyring: DomainKeyringService, count: number): void {
    for (let i = 1; i <= count; i++) {
      const id = `s${i}`;
      db.database.querySync(
        `INSERT INTO wealth_snapshots (id, owner_id, snapshot_date, payload_enc, key_version, created_at, updated_at)
         VALUES ($1, 'u1', $2, $3, $4, 'x', 'x')`,
        [
          id,
          `2026-01-${String(i).padStart(2, '0')}`,
          keyring.encrypt('wealth', rowAad('wealth_snapshots', id, 'u1'), { marker: id }),
          keyring.currentVersion('wealth'),
        ],
      );
    }
  }

  const read = (keyring: DomainKeyringService, id: string): unknown => {
    const [row] = db.database.querySync<{ payload_enc: string }>(
      'SELECT payload_enc FROM wealth_snapshots WHERE id = $1',
      [id],
    );
    return keyring.decrypt('wealth', rowAad('wealth_snapshots', id, 'u1'), row.payload_enc);
  };

  async function waitForRun(rotation: RotationService, runId: string): Promise<void> {
    for (let i = 0; i < 200; i++) {
      if (store.getRun(runId)?.status !== 'RUNNING') return;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error('run did not finish');
  }

  describe('status', () => {
    it('reports every domain with state, versions and counts only', () => {
      const { keyring, rotation } = boot(key());
      addSnapshots(keyring, 2);
      const wealth = rotation.status().find((s) => s.domain === 'wealth');
      expect(wealth).toMatchObject({
        state: 'READY',
        currentVersion: 2,
        retiredVersions: [],
        rotationPending: false,
        previousKeyRemovable: false,
        rowsPerVersion: { '2': 2 },
        lastRun: null,
        runningRun: null,
      });
      expect(rotation.status()).toHaveLength(6);
      expect(rotation.status().find((s) => s.domain === 'earnings')?.state).toBe('READY');
      expect(JSON.stringify(rotation.status())).not.toMatch(/k1:/);
    });

    it('looks up the acting admin e-mail', () => {
      const { rotation } = boot(key());
      expect(rotation.actorFor('nobody')).toEqual({ userId: 'nobody', email: null });
      expect(rotation.actorFor('admin-1').email).toBe('admin@example.com');
    });
  });

  describe('master key rotation', () => {
    it('re-wraps the data keys so the old key opens nothing and data stays readable', () => {
      const oldKey = key();
      const newKey = key();
      const first = boot(oldKey);
      addSnapshots(first.keyring, 2);

      const { keyring, rotation } = boot(newKey, oldKey);
      expect(rotation.status().find((s) => s.domain === 'wealth')).toMatchObject({
        rotationPending: true,
        previousKeyRemovable: false,
      });
      const run = rotation.rotateMasterKey('wealth', ACTOR);
      expect(run).toMatchObject({
        kind: 'MASTER_KEY',
        status: 'SUCCEEDED',
        recordsDone: 1,
        triggeredByEmail: 'admin@example.com',
      });
      expect(rotation.status().find((s) => s.domain === 'wealth')).toMatchObject({
        rotationPending: false,
        previousKeyRemovable: true,
      });

      const restarted = boot(newKey);
      expect(restarted.keyring.state('wealth')).toBe('READY');
      expect(read(restarted.keyring, 's1')).toEqual({ marker: 's1' });
      expect(read(keyring, 's2')).toEqual({ marker: 's2' });
      expect(boot(oldKey).keyring.state('wealth')).toBe('KEY_MISMATCH');
    });

    it('is idempotent: a second run re-wraps nothing', () => {
      const oldKey = key();
      boot(oldKey);
      const { rotation } = boot(key(), oldKey);
      expect(rotation.rotateMasterKey('wealth', ACTOR).recordsDone).toBe(1);
      expect(rotation.rotateMasterKey('wealth', ACTOR).recordsDone).toBe(0);
    });

    it('is refused for a domain that is not READY', () => {
      const { rotation } = boot();
      expect(() => rotation.rotateMasterKey('wealth', ACTOR)).toThrow(
        EncryptionDomainNotReadyException,
      );
    });

    it('is refused while another operation runs', () => {
      const { rotation } = boot(key());
      store.createRun({ domain: 'wealth', kind: 'DATA_KEY' });
      expect(() => rotation.rotateMasterKey('wealth', ACTOR)).toThrow(
        EncryptionOperationRunningException,
      );
    });

    it('fails without changing anything when a data key does not unwrap', () => {
      const { rotation } = boot(key());
      store.insertDataKey('wealth', 3, 'k1:AAAA:AAAA:AAAA', 'ffffffffffffffff', 'retired');
      const before = JSON.stringify(store.listDataKeys('wealth'));
      expect(() => rotation.rotateMasterKey('wealth', ACTOR)).toThrow(
        EncryptionDomainNotReadyException,
      );
      expect(JSON.stringify(store.listDataKeys('wealth'))).toBe(before);
      expect(store.history('wealth', 1)[0]).toMatchObject({
        status: 'FAILED',
        errorCode: 'KEY_MISMATCH',
      });
    });
  });

  describe('data key re-encryption', () => {
    it('requires the domain id as confirmation', () => {
      const { rotation } = boot(key());
      expect(() => rotation.startReencryption('wealth', 'earnings', ACTOR)).toThrow(
        EncryptionConfirmationMismatchException,
      );
      expect(() => rotation.startReencryption('wealth', '', ACTOR)).toThrow(
        EncryptionConfirmationMismatchException,
      );
    });

    it('moves every row to the new data key, locks the domain meanwhile and releases it', async () => {
      const { keyring, rotation } = boot(key());
      addSnapshots(keyring, 3);
      const run = rotation.startReencryption('wealth', 'wealth', ACTOR);
      expect(run).toMatchObject({
        kind: 'DATA_KEY',
        status: 'RUNNING',
        fromVersion: 2,
        toVersion: 3,
        recordsTotal: 3,
      });
      expect(keyring.state('wealth')).toBe('REENCRYPTING');
      expect(() => rotation.startReencryption('wealth', 'wealth', ACTOR)).toThrow(
        EncryptionDomainNotReadyException,
      );

      await waitForRun(rotation, run.id);
      expect(store.getRun(run.id)).toMatchObject({
        status: 'SUCCEEDED',
        recordsDone: 3,
        toVersion: 3,
      });
      expect(keyring.state('wealth')).toBe('READY');
      expect(store.countRowsPerVersion('wealth')).toEqual({ '3': 3 });
      expect(read(keyring, 's2')).toEqual({ marker: 's2' });
      expect(rotation.status().find((s) => s.domain === 'wealth')).toMatchObject({
        currentVersion: 3,
        retiredVersions: [2],
      });
    });

    it('marks the run failed and releases the lock when re-encryption breaks, rows stay readable', async () => {
      const { keyring, rotation } = boot(key());
      addSnapshots(keyring, 2);
      db.database.querySync(
        "UPDATE wealth_snapshots SET payload_enc = 'v2:AAAA:AAAA:AAAA' WHERE id = 's2'",
      );
      const run = rotation.startReencryption('wealth', 'wealth', ACTOR);
      await waitForRun(rotation, run.id);
      expect(store.getRun(run.id)).toMatchObject({ status: 'FAILED', errorCode: 'DB_ERROR' });
      expect(keyring.state('wealth')).toBe('READY');
      expect(read(keyring, 's1')).toEqual({ marker: 's1' });
    });
  });

  describe('destroying a retired data key', () => {
    async function reencrypted(): Promise<{
      keyring: DomainKeyringService;
      rotation: RotationService;
    }> {
      const booted = boot(key());
      addSnapshots(booted.keyring, 1);
      const run = booted.rotation.startReencryption('wealth', 'wealth', ACTOR);
      await waitForRun(booted.rotation, run.id);
      return booted;
    }

    it('destroys an unused retired key, keeps the tombstone and never reissues the version', async () => {
      const { keyring, rotation } = await reencrypted();
      const run = rotation.destroyDataKey('wealth', 2, ACTOR);
      expect(run).toMatchObject({
        kind: 'KEY_DESTROY',
        status: 'SUCCEEDED',
        fromVersion: 2,
        toVersion: 2,
      });
      expect(store.listDataKeys('wealth')[0]).toMatchObject({
        status: 'destroyed',
        wrappedDek: null,
      });
      expect(read(keyring, 's1')).toEqual({ marker: 's1' });

      const next = rotation.startReencryption('wealth', 'wealth', ACTOR);
      expect(next.toVersion).toBe(4);
      await waitForRun(rotation, next.id);
    });

    it('refuses the current key, unknown versions and keys still used by rows', async () => {
      const { keyring, rotation } = await reencrypted();
      expect(() => rotation.destroyDataKey('wealth', 3, ACTOR)).toThrow(
        EncryptionKeyNotRetiredException,
      );
      expect(() => rotation.destroyDataKey('wealth', 9, ACTOR)).toThrow();
      addSnapshots(keyring, 0);
      db.database.querySync("UPDATE wealth_snapshots SET payload_enc = 'v2:AAAA:AAAA:AAAA'");
      expect(() => rotation.destroyDataKey('wealth', 2, ACTOR)).toThrow(
        EncryptionKeyInUseException,
      );
      expect(store.listDataKeys('wealth')[0].status).toBe('retired');
    });
  });
});
