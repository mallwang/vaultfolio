import { Logger } from '@nestjs/common';
import type { WealthSettings, WealthSnapshot } from '@vaultfolio/api-contract';
import { UsersRepository } from '../auth/users.repository';
import {
  SECRET_AMOUNT,
  SECRET_NAME,
  type WealthSessions,
  type WealthTestApp,
  bootWealthApp,
  client,
  entry,
  signIn,
  signInSessions,
  snapshotPayload,
} from './wealth-e2e.helpers';
import { randomBytes } from 'node:crypto';

/**
 * HTTP e2e for `/wealth` (contracts/wealth-api.md) against a temp SQLite file with a test
 * encryption key. All payloads are invented.
 */
describe('/wealth', () => {
  let t: WealthTestApp;
  let s: WealthSessions;

  beforeAll(async () => {
    t = await bootWealthApp();
    s = await signInSessions(t);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await t.database.query('DELETE FROM wealth_snapshots');
    await t.database.query('DELETE FROM wealth_settings');
  });

  const create = async (payload: object = snapshotPayload(), who = s.member) => {
    const response = await who.post('/wealth/snapshots').send(payload);
    expect(response.status).toBe(201);
    return response.body as WealthSnapshot;
  };

  describe('access', () => {
    it('401 without a session, 403 without the domain scope', async () => {
      const { default: request } = await import('supertest');
      expect((await request(t.app.getHttpServer()).get('/wealth/snapshots')).status).toBe(401);
      expect((await s.outsider.get('/wealth/snapshots')).status).toBe(403);
      expect((await s.outsider.post('/wealth/snapshots').send(snapshotPayload())).status).toBe(403);
      expect((await s.outsider.get('/wealth/settings')).status).toBe(403);
    });

    it('lets entitled members and admins in', async () => {
      expect((await s.member.get('/wealth/snapshots')).status).toBe(200);
      expect((await s.admin.get('/wealth/snapshots')).status).toBe(200);
    });
  });

  describe('snapshots', () => {
    it('starts empty', async () => {
      expect((await s.member.get('/wealth/snapshots')).body).toEqual([]);
    });

    it('creates, reads, lists, updates and deletes a snapshot', async () => {
      const created = await create();
      expect(created).toMatchObject({
        snapshotDate: '2026-03-31',
        note: 'Quartalsende',
        entries: snapshotPayload().entries,
      });
      expect(created.id).toEqual(expect.any(String));
      expect(created.createdAt).toEqual(expect.any(String));
      expect(created).not.toHaveProperty('totals');

      expect((await s.member.get(`/wealth/snapshots/${created.id}`)).body).toEqual(created);
      expect((await s.member.get('/wealth/snapshots')).body).toEqual([created]);

      const put = await s.member
        .put(`/wealth/snapshots/${created.id}`)
        .send(snapshotPayload({ note: undefined, entries: [entry({ amount: '10.5' })] }));
      expect(put.status).toBe(200);
      expect(put.body.id).toBe(created.id);
      expect(put.body.note).toBeUndefined();
      expect(put.body.entries).toEqual([entry({ amount: '10.50' })]);

      expect((await s.member.del(`/wealth/snapshots/${created.id}`)).status).toBe(204);
      expect((await s.member.get(`/wealth/snapshots/${created.id}`)).status).toBe(404);
      expect((await s.member.get('/wealth/snapshots')).body).toEqual([]);
    });

    it('lists ascending by date regardless of creation order', async () => {
      await create(snapshotPayload({ snapshotDate: '2026-03-31' }));
      await create(snapshotPayload({ snapshotDate: '2024-12-31' }));
      await create(snapshotPayload({ snapshotDate: '2025-06-30' }));
      const dates = ((await s.member.get('/wealth/snapshots')).body as WealthSnapshot[]).map(
        (snapshot) => snapshot.snapshotDate,
      );
      expect(dates).toEqual(['2024-12-31', '2025-06-30', '2026-03-31']);
    });

    it('answers 404 WEALTH_SNAPSHOT_NOT_FOUND for unknown ids on get, put and delete', async () => {
      for (const response of [
        await s.member.get('/wealth/snapshots/nope'),
        await s.member.put('/wealth/snapshots/nope').send(snapshotPayload()),
        await s.member.del('/wealth/snapshots/nope'),
      ]) {
        expect(response.status).toBe(404);
        expect(response.body.error).toBe('WEALTH_SNAPSHOT_NOT_FOUND');
      }
    });
  });

  describe('duplicate date', () => {
    it('answers 409 with existingId on create', async () => {
      const first = await create();
      const response = await s.member.post('/wealth/snapshots').send(snapshotPayload());
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        error: 'WEALTH_SNAPSHOT_DATE_EXISTS',
        existingId: first.id,
      });
    });

    it('answers 409 when an update moves a snapshot onto another one’s date', async () => {
      const a = await create(snapshotPayload({ snapshotDate: '2026-01-31' }));
      const b = await create(snapshotPayload({ snapshotDate: '2026-02-28' }));
      const response = await s.member
        .put(`/wealth/snapshots/${b.id}`)
        .send(snapshotPayload({ snapshotDate: '2026-01-31' }));
      expect(response.status).toBe(409);
      expect(response.body.existingId).toBe(a.id);
      const unchanged = await s.member.get(`/wealth/snapshots/${b.id}`);
      expect(unchanged.body.snapshotDate).toBe('2026-02-28');
    });

    it('lets an update keep its own date and lets two owners share a date', async () => {
      const mine = await create();
      expect(
        (await s.member.put(`/wealth/snapshots/${mine.id}`).send(snapshotPayload())).status,
      ).toBe(200);
      await create(snapshotPayload(), s.other);
    });
  });

  describe('validation', () => {
    it('rejects an unknown field with 400 WEALTH_UNKNOWN_FIELD naming the field only', async () => {
      const response = await s.member
        .post('/wealth/snapshots')
        .send({ ...snapshotPayload(), bankAccount: 'DE00 SECRET-IBAN' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('WEALTH_UNKNOWN_FIELD');
      expect(response.body.details).toEqual([{ field: 'bankAccount', message: 'UNKNOWN_FIELD' }]);
      expect(JSON.stringify(response.body)).not.toContain('SECRET-IBAN');
    });

    it('rejects a standard class on the wrong side as WEALTH_UNKNOWN_FIELD', async () => {
      const response = await s.member.post('/wealth/snapshots').send(
        snapshotPayload({
          entries: [entry({ side: 'LIABILITY', class: { standard: 'cash' } })],
        }),
      );
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('WEALTH_UNKNOWN_FIELD');
    });

    it('rejects invalid values with 400 WEALTH_VALIDATION and field names', async () => {
      const response = await s.member.post('/wealth/snapshots').send({
        snapshotDate: '2999-01-01',
        entries: [entry({ amount: '-5.00', name: ' ' })],
      });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('WEALTH_VALIDATION');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          { field: 'snapshotDate', message: 'OUT_OF_RANGE' },
          { field: 'entries[0].name', message: 'REQUIRED' },
          { field: 'entries[0].amount', message: 'INVALID_AMOUNT' },
        ]),
      );
    });

    it('rejects a snapshot without entries', async () => {
      const response = await s.member
        .post('/wealth/snapshots')
        .send(snapshotPayload({ entries: [] }));
      expect(response.status).toBe(400);
      expect(response.body.details).toEqual([{ field: 'entries', message: 'REQUIRED' }]);
    });

    it('enforces the 200-entry limit with WEALTH_LIMIT_EXCEEDED', async () => {
      const response = await s.member
        .post('/wealth/snapshots')
        .send(snapshotPayload({ entries: Array.from({ length: 201 }, () => entry()) }));
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('WEALTH_LIMIT_EXCEEDED');
    });

    it('enforces the 600-snapshot limit with WEALTH_LIMIT_EXCEEDED', async () => {
      const now = new Date().toISOString();
      await t.database.query(
        `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < 599)
         INSERT INTO wealth_snapshots (id, owner_id, snapshot_date, payload_enc, created_at, updated_at)
         SELECT 'filler-' || i, $1, date('2000-01-01', '+' || i || ' months'), 'v1:x:x:x', $2, $2 FROM n`,
        [s.memberId, now],
      );
      const response = await s.member
        .post('/wealth/snapshots')
        .send(snapshotPayload({ snapshotDate: '2026-03-31' }));
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('WEALTH_LIMIT_EXCEEDED');
    });
  });

  describe('owner isolation', () => {
    it('treats another owner’s snapshot like a missing one and never lists it', async () => {
      const theirs = await create(snapshotPayload(), s.other);
      expect((await s.member.get('/wealth/snapshots')).body).toEqual([]);
      expect((await s.member.get(`/wealth/snapshots/${theirs.id}`)).status).toBe(404);
      expect(
        (await s.member.put(`/wealth/snapshots/${theirs.id}`).send(snapshotPayload())).status,
      ).toBe(404);
      expect((await s.member.del(`/wealth/snapshots/${theirs.id}`)).status).toBe(404);
      expect((await s.other.get(`/wealth/snapshots/${theirs.id}`)).status).toBe(200);
    });
  });

  describe('settings', () => {
    it('is empty for a new owner', async () => {
      expect((await s.member.get('/wealth/settings')).body).toEqual({ classGroups: [] });
    });

    it('upserts and replaces assignments by (side, class identity)', async () => {
      const put = (body: object, who = s.member) =>
        who.put('/wealth/settings/class-groups').send(body);

      let response = await put({ side: 'ASSET', class: { custom: 'Whisky' }, group: 'TANGIBLE' });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        classGroups: [{ side: 'ASSET', class: { custom: 'Whisky' }, group: 'TANGIBLE' }],
      });

      await put({ side: 'ASSET', class: { standard: 'crypto' }, group: 'OTHER_ASSET' });
      response = await put({ side: 'ASSET', class: { custom: ' WHISKY ' }, group: 'OTHER_ASSET' });
      const settings = response.body as WealthSettings;
      expect(settings.classGroups).toHaveLength(2);
      expect(settings.classGroups).toEqual(
        expect.arrayContaining([
          { side: 'ASSET', class: { custom: 'WHISKY' }, group: 'OTHER_ASSET' },
          { side: 'ASSET', class: { standard: 'crypto' }, group: 'OTHER_ASSET' },
        ]),
      );

      // Same text on the other side is a different class.
      response = await put({ side: 'LIABILITY', class: { custom: 'Whisky' }, group: 'SHORT_TERM' });
      expect((response.body as WealthSettings).classGroups).toHaveLength(3);
      expect((await s.member.get('/wealth/settings')).body).toEqual(response.body);
    });

    it('rejects a group of the wrong side as WEALTH_UNKNOWN_FIELD', async () => {
      const response = await s.member
        .put('/wealth/settings/class-groups')
        .send({ side: 'ASSET', class: { custom: 'Whisky' }, group: 'LONG_TERM' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('WEALTH_UNKNOWN_FIELD');
      expect(response.body.details).toEqual([{ field: 'group', message: 'UNKNOWN_FIELD' }]);
    });

    it('isolates settings per owner and keeps them when snapshots are deleted', async () => {
      await s.member
        .put('/wealth/settings/class-groups')
        .send({ side: 'ASSET', class: { custom: 'Whisky' }, group: 'TANGIBLE' });
      expect((await s.other.get('/wealth/settings')).body).toEqual({ classGroups: [] });

      const snapshot = await create();
      await s.member.del(`/wealth/snapshots/${snapshot.id}`);
      expect((await s.member.get('/wealth/settings')).body.classGroups).toHaveLength(1);
    });

    it('stores the settings as ciphertext', async () => {
      await s.member
        .put('/wealth/settings/class-groups')
        .send({ side: 'ASSET', class: { custom: SECRET_NAME.slice(0, 20) }, group: 'TANGIBLE' });
      const rows = await t.database.query<Record<string, unknown>>('SELECT * FROM wealth_settings');
      expect(rows).toHaveLength(1);
      expect(JSON.stringify(rows[0])).not.toContain(SECRET_NAME.slice(0, 10));
      expect(rows[0]['payload_enc']).toMatch(/^v2:/);
    });
  });

  describe('DELETE /wealth', () => {
    it('purges only the caller’s snapshots and settings', async () => {
      await create();
      await create(snapshotPayload({ snapshotDate: '2026-02-28' }));
      await s.member
        .put('/wealth/settings/class-groups')
        .send({ side: 'ASSET', class: { custom: 'Whisky' }, group: 'TANGIBLE' });
      const theirs = await create(snapshotPayload(), s.other);
      await s.other
        .put('/wealth/settings/class-groups')
        .send({ side: 'ASSET', class: { custom: 'Wein' }, group: 'OTHER_ASSET' });

      expect((await s.member.del('/wealth')).status).toBe(204);
      expect((await s.member.get('/wealth/snapshots')).body).toEqual([]);
      expect((await s.member.get('/wealth/settings')).body).toEqual({ classGroups: [] });
      expect((await s.other.get(`/wealth/snapshots/${theirs.id}`)).status).toBe(200);
      expect((await s.other.get('/wealth/settings')).body.classGroups).toHaveLength(1);
    });
  });

  describe('account deletion', () => {
    it('removes the user’s snapshots and settings (FR-021)', async () => {
      await create(snapshotPayload(), s.other);
      await s.other
        .put('/wealth/settings/class-groups')
        .send({ side: 'ASSET', class: { custom: 'Wein' }, group: 'OTHER_ASSET' });
      await create();
      await t.app.get(UsersRepository, { strict: false }).deleteById(s.otherId);
      const snapshots = await t.database.query<{ owner_id: string }>(
        'SELECT owner_id FROM wealth_snapshots',
      );
      expect(snapshots.map((r) => r.owner_id)).toEqual([s.memberId]);
      expect(await t.database.query('SELECT 1 FROM wealth_settings')).toEqual([]);
    });
  });

  describe('privacy', () => {
    it('keeps names, notes and amounts out of every stored column', async () => {
      await create();
      const rows = await t.database.query<Record<string, unknown>>(
        'SELECT * FROM wealth_snapshots',
      );
      expect(rows).toHaveLength(1);
      const stored = JSON.stringify(rows[0]);
      const decoded = Buffer.from(
        String(rows[0]['payload_enc']).split(':').slice(1).join(''),
        'base64',
      ).toString('latin1');
      for (const secret of [
        SECRET_NAME,
        SECRET_AMOUNT,
        'Girokonto',
        'Baudarlehen',
        'Quartalsende',
      ]) {
        expect(stored).not.toContain(secret);
        expect(decoded).not.toContain(secret);
      }
      expect(rows[0]['payload_enc']).toMatch(/^v2:/);
      expect(rows[0]['snapshot_date']).toBe('2026-03-31');
    });

    it('logs ids and counts only — never names or amounts', async () => {
      const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((level) =>
        jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined),
      );
      try {
        const created = await create();
        await s.member.put(`/wealth/snapshots/${created.id}`).send(snapshotPayload());
        await s.member.post('/wealth/snapshots').send(snapshotPayload());
        await s.member
          .post('/wealth/snapshots')
          .send({ ...snapshotPayload({ snapshotDate: '2026-04-30' }), leak: SECRET_NAME });
        await s.member.del(`/wealth/snapshots/${created.id}`);
        const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
        expect(logged).toContain('WealthSnapshotCreated');
        for (const secret of [
          SECRET_NAME,
          SECRET_AMOUNT,
          'Girokonto',
          'Baudarlehen',
          'Quartalsende',
        ]) {
          expect(logged).not.toContain(secret);
        }
      } finally {
        for (const spy of spies) spy.mockRestore();
      }
    });
  });
});

describe('/wealth without ENCRYPTION_KEY', () => {
  let t: WealthTestApp;
  let s: WealthSessions;

  beforeAll(async () => {
    t = await bootWealthApp({ key: null });
    s = await signInSessions(t);
  });

  afterAll(async () => {
    await t.close();
  });

  it('answers 503 WEALTH_UNAVAILABLE on every route while Holdings still works', async () => {
    const id = 'any-id';
    const calls = [
      await s.member.get('/wealth/snapshots'),
      await s.member.get(`/wealth/snapshots/${id}`),
      await s.member.post('/wealth/snapshots').send(snapshotPayload()),
      await s.member.put(`/wealth/snapshots/${id}`).send(snapshotPayload()),
      await s.member.del(`/wealth/snapshots/${id}`),
      await s.member.get('/wealth/settings'),
      await s.member
        .put('/wealth/settings/class-groups')
        .send({ side: 'ASSET', class: { custom: 'x' }, group: 'LIQUID' }),
      await s.member.del('/wealth'),
    ];
    for (const response of calls) {
      expect(response.status).toBe(503);
      expect(response.body.error).toBe('WEALTH_UNAVAILABLE');
    }
    expect((await s.admin.get('/holdings')).status).toBe(503);
  });
});

describe('/wealth with a different key than the stored data', () => {
  it('fails closed with 503 instead of returning garbage', async () => {
    const first = await bootWealthApp();
    const sessions = await signInSessions(first);
    expect((await sessions.member.post('/wealth/snapshots').send(snapshotPayload())).status).toBe(
      201,
    );
    await first.close();

    const second = await bootWealthApp({
      tempDir: first.tempDir,
      key: randomBytes(32).toString('base64'),
    });
    try {
      // Users already exist in the reused database, so sign in directly.
      const member = client(second.app, await signIn(second.app, 'member@example.com'));
      const response = await member.get('/wealth/snapshots');
      expect(response.status).toBe(503);
      expect(response.body.error).toBe('WEALTH_UNAVAILABLE');
    } finally {
      await second.close();
    }
  });
});
