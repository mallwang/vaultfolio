import * as fs from 'node:fs';
import type {
  DomainKeyStatus,
  EncryptionDomainId,
  EncryptionHistoryResponse,
  EncryptionStatusResponse,
  RotationRun,
} from '@vaultfolio/api-contract';
import { DOMAIN_ENCRYPTION, rowAad } from '../encryption/domain-encryption.registry';
import { DomainKeyringService } from '../encryption/domain-keyring.service';
import {
  ADMIN_EMAIL,
  bootEncryptionApp,
  client,
  makeTempDir,
  newKey,
  seedLegacyDatabase,
  signIn,
  type EncryptionTestApp,
} from './encryption-e2e.helpers';
import { snapshotPayload } from './wealth-e2e.helpers';

type Api = ReturnType<typeof client>;

async function adminApi(t: EncryptionTestApp): Promise<Api> {
  return client(t.app, await signIn(t.app, ADMIN_EMAIL));
}

async function status(api: Api): Promise<Record<EncryptionDomainId, DomainKeyStatus>> {
  const body = (await api.get('/admin/encryption/status')).body as EncryptionStatusResponse;
  return Object.fromEntries(body.domains.map((d) => [d.domain, d])) as Record<
    EncryptionDomainId,
    DomainKeyStatus
  >;
}

async function waitUntilIdle(api: Api, domain: EncryptionDomainId): Promise<DomainKeyStatus> {
  for (let i = 0; i < 400; i++) {
    const current = (await status(api))[domain];
    if (current.state === 'READY' && current.runningRun === null) return current;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('domain did not become idle');
}

function dumpEncryptedRows(t: EncryptionTestApp): string {
  return JSON.stringify(
    DOMAIN_ENCRYPTION.flatMap((d) => d.tables).map((table) =>
      t.database.querySync(`SELECT * FROM ${table.table} ORDER BY ${table.idColumn}`),
    ),
  );
}

describe('encryption: upgrade of a pre-feature database (US4)', () => {
  const dir = makeTempDir();
  const key = newKey();
  let t: EncryptionTestApp;

  beforeAll(async () => {
    await seedLegacyDatabase(dir, key);
    t = await bootEncryptionApp({ tempDir: dir, key });
  });

  afterAll(async () => {
    await t.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads every legacy row with the exact plaintext and moves it to data key v2', () => {
    const keyring = t.app.get(DomainKeyringService);
    for (const domain of DOMAIN_ENCRYPTION) {
      expect(keyring.state(domain.id)).toBe('READY');
      for (const table of domain.tables) {
        const [row] = t.database.querySync<{
          id: string;
          owner_id: string;
          c: string;
          key_version: number;
        }>(
          `SELECT ${table.idColumn} AS id, owner_id, ${table.ciphertextColumn} AS c, key_version FROM ${table.table}`,
        );
        expect(row.c.startsWith('v2:')).toBe(true);
        expect(row.key_version).toBe(2);
        expect(
          keyring.decrypt(domain.id, rowAad(table.table, row.id, row.owner_id), row.c),
        ).toEqual({ marker: `secret-${table.table}` });
      }
    }
  });

  it('records one LEGACY_MIGRATION run per domain and reports counts per version', async () => {
    const api = await adminApi(t);
    const history = (await api.get('/admin/encryption/history')).body as EncryptionHistoryResponse;
    expect(history.runs).toHaveLength(7);
    for (const run of history.runs) {
      expect(run).toMatchObject({
        kind: 'LEGACY_MIGRATION',
        status: 'SUCCEEDED',
        triggeredByEmail: null,
        fromVersion: 1,
        toVersion: 2,
      });
    }
    const all = await status(api);
    expect(all.wealth.rowsPerVersion).toEqual({ '2': 2 });
    expect(all.earnings.currentVersion).toBe(2);
  });

  it('writes new data under the data key', async () => {
    const api = await adminApi(t);
    const created = await api.post('/wealth/snapshots').send(snapshotPayload());
    expect(created.status).toBe(201);
    const [row] = t.database.querySync<{ payload_enc: string; key_version: number }>(
      'SELECT payload_enc, key_version FROM wealth_snapshots WHERE id = $1',
      [created.body.id],
    );
    expect(row.payload_enc.startsWith('v2:')).toBe(true);
    expect(row.key_version).toBe(2);
    expect((await api.get(`/wealth/snapshots/${created.body.id}`)).status).toBe(200);
  });
});

describe('encryption: missing or wrong key never damages data (US3)', () => {
  const dir = makeTempDir();
  const key = newKey();

  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('locks the encrypted domains, writes nothing and recovers with the right key', async () => {
    let t = await bootEncryptionApp({ tempDir: dir, key });
    let api = await adminApi(t);
    const created = await api.post('/wealth/snapshots').send(snapshotPayload());
    expect(created.status).toBe(201);
    const before = dumpEncryptedRows(t);
    const keysBefore = JSON.stringify(t.database.querySync('SELECT * FROM encryption_data_keys'));
    await t.close();

    for (const [label, wrongKey, expected] of [
      ['missing', null, 'KEY_MISSING'],
      ['wrong', newKey(), 'KEY_MISMATCH'],
    ] as const) {
      t = await bootEncryptionApp({ tempDir: dir, key: wrongKey });
      api = await adminApi(t);
      const response = await api.get('/wealth/snapshots');
      expect([label, response.status, response.body.error]).toEqual([
        label,
        503,
        'WEALTH_UNAVAILABLE',
      ]);
      expect((await api.post('/wealth/snapshots').send(snapshotPayload())).status).toBe(503);
      expect((await api.get('/holdings')).status).toBe(503);
      const all = await status(api);
      expect(all.wealth.state).toBe(expected);
      expect(all.insurances.state).toBe(expected);
      expect(dumpEncryptedRows(t)).toBe(before);
      expect(JSON.stringify(t.database.querySync('SELECT * FROM encryption_data_keys'))).toBe(
        keysBefore,
      );
      await t.close();
    }

    t = await bootEncryptionApp({ tempDir: dir, key });
    api = await adminApi(t);
    const restored = await api.get(`/wealth/snapshots/${created.body.id}`);
    expect(restored.status).toBe(200);
    expect(restored.body.entries).toEqual(snapshotPayload().entries);
    await t.close();
  });
});

describe('encryption: admin API access', () => {
  const dir = makeTempDir();
  let t: EncryptionTestApp;

  beforeAll(async () => {
    t = await bootEncryptionApp({ tempDir: dir, key: newKey() });
  });

  afterAll(async () => {
    await t.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('requires a session', async () => {
    const { default: request } = await import('supertest');
    expect((await request(t.app.getHttpServer()).get('/admin/encryption/status')).status).toBe(401);
  });

  it('rejects unknown domains, bad confirmation and bad versions', async () => {
    const api = await adminApi(t);
    expect((await api.post('/admin/encryption/domains/nope/master-key-rotation')).status).toBe(404);
    expect((await api.get('/admin/encryption/history?domain=nope')).status).toBe(404);
    const wrong = await api
      .post('/admin/encryption/domains/wealth/reencryption')
      .send({ confirm: 'earnings' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toBe('ENCRYPTION_CONFIRMATION_MISMATCH');
    expect((await api.post('/admin/encryption/domains/wealth/data-keys/1/destroy')).status).toBe(
      404,
    );
    const current = await api.post('/admin/encryption/domains/wealth/data-keys/2/destroy');
    expect(current.status).toBe(409);
    expect(current.body.error).toBe('ENCRYPTION_KEY_NOT_RETIRED');
  });

  it('never exposes key material in the status', async () => {
    const api = await adminApi(t);
    const raw = JSON.stringify((await api.get('/admin/encryption/status')).body);
    expect(raw).not.toMatch(/k1:|fingerprint|wrapped/i);
  });
});

describe('encryption: master key rotation (US1)', () => {
  const dir = makeTempDir();
  const oldKey = newKey();
  const newMaster = newKey();

  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('rotates every domain, drops the previous key and the old key opens nothing', async () => {
    let t = await bootEncryptionApp({ tempDir: dir, key: oldKey });
    let api = await adminApi(t);
    const created = await api.post('/wealth/snapshots').send(snapshotPayload());
    expect(created.status).toBe(201);
    await t.close();

    t = await bootEncryptionApp({ tempDir: dir, key: newMaster, previous: oldKey });
    api = await adminApi(t);
    const pending = await status(api);
    for (const d of DOMAIN_ENCRYPTION) {
      expect(pending[d.id]).toMatchObject({ state: 'READY', rotationPending: true });
    }
    expect((await api.get(`/wealth/snapshots/${created.body.id}`)).status).toBe(200);

    for (const d of DOMAIN_ENCRYPTION) {
      const response = await api.post(`/admin/encryption/domains/${d.id}/master-key-rotation`);
      expect(response.status).toBe(200);
      expect(response.body as RotationRun).toMatchObject({
        kind: 'MASTER_KEY',
        status: 'SUCCEEDED',
        recordsDone: 1,
        triggeredByEmail: ADMIN_EMAIL,
      });
    }
    const done = await status(api);
    expect(done.wealth).toMatchObject({ rotationPending: false, previousKeyRemovable: true });
    await t.close();

    t = await bootEncryptionApp({ tempDir: dir, key: newMaster });
    api = await adminApi(t);
    const read = await api.get(`/wealth/snapshots/${created.body.id}`);
    expect(read.status).toBe(200);
    expect(read.body.entries).toEqual(snapshotPayload().entries);
    await t.close();

    t = await bootEncryptionApp({ tempDir: dir, key: oldKey });
    api = await adminApi(t);
    expect((await status(api)).wealth.state).toBe('KEY_MISMATCH');
    expect((await api.get('/wealth/snapshots')).status).toBe(503);
    await t.close();
  });
});

describe('encryption: data key re-encryption and destroy (US2)', () => {
  const dir = makeTempDir();
  let t: EncryptionTestApp;

  beforeAll(async () => {
    t = await bootEncryptionApp({ tempDir: dir, key: newKey() });
  });

  afterAll(async () => {
    await t.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('re-encrypts all rows onto a new data key, destroys the retired key and records the history', async () => {
    const api = await adminApi(t);
    const ids: string[] = [];
    for (const date of ['2026-01-31', '2026-02-28', '2026-03-31']) {
      const created = await api
        .post('/wealth/snapshots')
        .send(snapshotPayload({ snapshotDate: date }));
      expect(created.status).toBe(201);
      ids.push(created.body.id as string);
    }

    const started = await api
      .post('/admin/encryption/domains/wealth/reencryption')
      .send({ confirm: 'wealth' });
    expect(started.status).toBe(202);
    expect(started.body).toMatchObject({
      kind: 'DATA_KEY',
      status: 'RUNNING',
      fromVersion: 2,
      toVersion: 3,
    });

    const idle = await waitUntilIdle(api, 'wealth');
    expect(idle).toMatchObject({
      currentVersion: 3,
      retiredVersions: [2],
      rowsPerVersion: { '3': 3 },
      lastRun: { status: 'SUCCEEDED', recordsDone: 3 },
    });
    for (const id of ids) {
      const read = await api.get(`/wealth/snapshots/${id}`);
      expect(read.status).toBe(200);
      expect(read.body.entries).toEqual(snapshotPayload().entries);
    }
    expect((await status(api)).earnings.state).toBe('READY');

    const inUse = await api.post('/admin/encryption/domains/earnings/data-keys/2/destroy');
    expect(inUse.status).toBe(409);
    const destroyed = await api.post('/admin/encryption/domains/wealth/data-keys/2/destroy');
    expect(destroyed.status).toBe(200);
    expect(destroyed.body).toMatchObject({ kind: 'KEY_DESTROY', status: 'SUCCEEDED' });
    expect((await status(api)).wealth.retiredVersions).toEqual([]);

    const history = (await api.get('/admin/encryption/history?domain=wealth'))
      .body as EncryptionHistoryResponse;
    expect(history.runs.map((r) => r.kind)).toEqual(['KEY_DESTROY', 'DATA_KEY']);
    expect(history.runs.every((r) => r.triggeredByEmail === ADMIN_EMAIL)).toBe(true);
  });
});
