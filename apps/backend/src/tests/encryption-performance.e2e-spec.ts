import { randomBytes } from 'node:crypto';
import { rowAad } from '../encryption/domain-encryption.registry';
import {
  createTestDatabase,
  createTestKeyring,
  type TestDatabase,
} from '../encryption/encryption.testing';
import { KeyStoreRepository } from '../encryption/key-store.repository';
import { RotationService } from '../encryption/rotation.service';

/** SC-007 timing check on synthetic rows only; slow, so run it with `ENCRYPTION_PERF=1`. */
const slow = process.env.ENCRYPTION_PERF === '1' ? describe : describe.skip;
const ROWS = 10_000;

slow('encryption performance (SC-007)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    delete process.env.WEALTH_ENCRYPTION_KEY;
    delete process.env.WEALTH_ENCRYPTION_KEY_PREVIOUS;
    await db.dispose();
  }, 60_000);

  it('rotates the master key in under a minute and re-encrypts 10,000 rows in under ten', async () => {
    const oldKey = randomBytes(32).toString('base64');
    process.env.WEALTH_ENCRYPTION_KEY = oldKey;
    const first = createTestKeyring(db.database);
    db.database.transaction(() => {
      for (let i = 0; i < ROWS; i++) {
        const id = `s${i}`;
        db.database.querySync(
          `INSERT INTO wealth_snapshots (id, owner_id, snapshot_date, payload_enc, key_version, created_at, updated_at)
           VALUES ($1, $2, '2026-01-01', $3, 2, 'x', 'x')`,
          [
            id,
            `u${i}`,
            first.encrypt('wealth', rowAad('wealth_snapshots', id, `u${i}`), { marker: id }),
          ],
        );
      }
    });

    process.env.WEALTH_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    process.env.WEALTH_ENCRYPTION_KEY_PREVIOUS = oldKey;
    const keyring = createTestKeyring(db.database);
    db.database.querySync(
      "INSERT INTO users (id, email, display_name, password_hash, role) VALUES ('perf-admin', 'perf@example.com', 'Perf', 'x', 'ADMIN')",
    );
    const store = new KeyStoreRepository(db.database);
    const rotation = new RotationService(keyring, store, db.database);
    const actor = rotation.actorFor('perf-admin');

    const wrapStart = Date.now();
    rotation.rotateMasterKey('wealth', actor);
    expect(Date.now() - wrapStart).toBeLessThan(60_000);

    const run = rotation.startReencryption('wealth', 'wealth', actor);
    const start = Date.now();
    while (store.getRun(run.id)?.status === 'RUNNING') {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(Date.now() - start).toBeLessThan(600_000);
    expect(store.getRun(run.id)).toMatchObject({ status: 'SUCCEEDED', recordsDone: ROWS });
    expect(store.countRowsPerVersion('wealth')).toEqual({ '3': ROWS });
  }, 700_000);
});
