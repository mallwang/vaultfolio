import { createTestDatabase, type TestDatabase } from './encryption.testing';
import { KeyStoreRepository } from './key-store.repository';

describe('KeyStoreRepository', () => {
  let db: TestDatabase;
  let store: KeyStoreRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    store = new KeyStoreRepository(db.database);
  });

  afterEach(() => db.dispose());

  const insertSnapshot = (id: string, ciphertext: string) =>
    db.database.querySync(
      `INSERT INTO wealth_snapshots (id, owner_id, snapshot_date, payload_enc, key_version, created_at, updated_at)
       VALUES ($1, 'u1', $2, $3, 1, 'x', 'x')`,
      [id, `2026-01-0${id.length}`, ciphertext],
    );

  describe('data keys', () => {
    it('lists, versions and transitions keys', () => {
      expect(store.highestVersion('wealth')).toBe(1);
      store.insertDataKey('wealth', 2, 'k1:a:b:c', 'fp1', 'current');
      store.retireCurrent('wealth');
      store.insertDataKey('wealth', 3, 'k1:d:e:f', 'fp1', 'current');
      expect(store.highestVersion('wealth')).toBe(3);
      expect(store.listDataKeys('wealth').map((k) => [k.version, k.status])).toEqual([
        [2, 'retired'],
        [3, 'current'],
      ]);
      expect(store.listDataKeys('earnings')).toEqual([]);
    });

    it('re-wraps a key and destroys a retired one as a tombstone that keeps its version', () => {
      store.insertDataKey('wealth', 2, 'k1:a:b:c', 'fp1', 'current');
      store.updateWrapping('wealth', 2, 'k1:z:z:z', 'fp2');
      expect(store.listDataKeys('wealth')[0]).toMatchObject({
        wrappedDek: 'k1:z:z:z',
        kekFingerprint: 'fp2',
      });

      store.markDestroyed('wealth', 2);
      expect(store.listDataKeys('wealth')[0].status).toBe('current');

      store.retireCurrent('wealth');
      store.markDestroyed('wealth', 2);
      expect(store.listDataKeys('wealth')[0]).toMatchObject({
        status: 'destroyed',
        wrappedDek: null,
        kekFingerprint: null,
      });
      expect(store.highestVersion('wealth')).toBe(2);
    });
  });

  describe('row counts by ciphertext version', () => {
    it('counts rows per version across the domain tables', () => {
      insertSnapshot('a', 'v2:x:y:z');
      insertSnapshot('bb', 'v2:x:y:z');
      insertSnapshot('ccc', 'v3:x:y:z');
      db.database.querySync(
        "INSERT INTO wealth_settings (owner_id, payload_enc, key_version, updated_at) VALUES ('u1', 'v2:x:y:z', 2, 'x')",
      );
      expect(store.countRowsPerVersion('wealth')).toEqual({ '2': 3, '3': 1 });
      expect(store.countRowsAtVersion('wealth', 3)).toBe(1);
      expect(store.countRowsAtVersion('wealth', 9)).toBe(0);
      expect(store.countRowsBelow('wealth', 3)).toBe(3);
      expect(store.countRowsPerVersion('earnings')).toEqual({});
    });
  });

  describe('rotation runs', () => {
    it('tracks a run from start to finish with progress', () => {
      const run = store.createRun({
        domain: 'wealth',
        kind: 'DATA_KEY',
        triggeredByEmail: 'admin@example.com',
        fromVersion: 2,
        toVersion: 3,
        recordsTotal: 10,
      });
      expect(run).toMatchObject({
        status: 'RUNNING',
        recordsDone: 0,
        recordsTotal: 10,
        finishedAt: null,
      });
      expect(store.runningRun('wealth')?.id).toBe(run.id);

      store.updateProgress(run.id, 4);
      store.updateToVersion(run.id, 3);
      const done = store.finishRun(run.id, 'SUCCEEDED');
      expect(done).toMatchObject({
        status: 'SUCCEEDED',
        recordsDone: 4,
        toVersion: 3,
        errorCode: null,
      });
      expect(done.finishedAt).not.toBeNull();
      expect(store.runningRun('wealth')).toBeNull();
    });

    it('allows one RUNNING run per domain and marks leftovers interrupted at start', () => {
      store.createRun({ domain: 'wealth', kind: 'MASTER_KEY' });
      expect(() => store.createRun({ domain: 'wealth', kind: 'DATA_KEY' })).toThrow(/UNIQUE/);
      store.createRun({ domain: 'earnings', kind: 'MASTER_KEY' });
      store.markLeftoverRunsInterrupted();
      expect(store.history(undefined, 10).map((r) => r.status)).toEqual([
        'INTERRUPTED',
        'INTERRUPTED',
      ]);
    });

    it('lists the newest first, filterable by domain and limit', () => {
      const first = store.createRun({ domain: 'wealth', kind: 'MASTER_KEY' });
      store.finishRun(first.id, 'FAILED', 'KEY_MISMATCH');
      const second = store.createRun({ domain: 'wealth', kind: 'DATA_KEY' });
      const other = store.createRun({ domain: 'earnings', kind: 'MASTER_KEY' });
      expect(store.history('wealth', 10).map((r) => r.id)).toEqual([second.id, first.id]);
      expect(store.history(undefined, 1)[0].id).toBe(other.id);
      expect(store.lastRun('wealth')?.id).toBe(second.id);
      expect(store.getRun(first.id)?.errorCode).toBe('KEY_MISMATCH');
      expect(store.getRun('nope')).toBeNull();
    });
  });
});
