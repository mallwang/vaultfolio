import type { RetirementRecord } from '@vaultfolio/api-contract';
import {
  type RetirementSessions,
  type RetirementTestApp,
  bootRetirementApp,
  depotPayload,
  importedRiesterPayload,
  importedStatutoryPayload,
  occupationalPayload,
  riesterPayload,
  signInSessions,
  statutoryPayload,
} from './retirement-e2e.helpers';

/**
 * HTTP e2e for `/retirement` (contracts/retirement-api.md) against a temp SQLite file with a test
 * encryption key. All payloads are invented.
 */
describe('/retirement', () => {
  let t: RetirementTestApp;
  let s: RetirementSessions;

  beforeAll(async () => {
    t = await bootRetirementApp();
    s = await signInSessions(t);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await t.database.query('DELETE FROM retirement_records');
  });

  const create = async (payload: object, who = s.member): Promise<RetirementRecord> => {
    const response = await who.post('/retirement/records').send(payload);
    expect(response.status).toBe(201);
    return response.body as RetirementRecord;
  };

  describe('access', () => {
    it('401 without a session, 403 without the retirement scope', async () => {
      const { default: request } = await import('supertest');
      expect((await request(t.app.getHttpServer()).get('/retirement/records')).status).toBe(401);
      const response = await s.outsider.get('/retirement/records');
      expect(response.status).toBe(403);
      expect((await s.outsider.post('/retirement/records').send(riesterPayload())).status).toBe(
        403,
      );
    });

    it('lets entitled members and admins in', async () => {
      expect((await s.member.get('/retirement/records')).status).toBe(200);
      expect((await s.admin.get('/retirement/records')).status).toBe(200);
    });
  });

  describe('manual records', () => {
    it('creates, lists, reads, replaces and deletes a record', async () => {
      const created = await create(occupationalPayload());
      expect(created).toMatchObject({
        pillar: 'OCCUPATIONAL',
        contractType: 'DIRECT_INSURANCE',
        origin: 'MANUAL',
        providerLabel: 'Muster Arbeitgeber GmbH',
        identifier: 'DV-4711',
        supplement: null,
        import: null,
        figures: { guaranteedMonthly: '200.00', expectedMonthly: '280.00' },
      });

      const list = await s.member.get('/retirement/records');
      expect(list.body).toHaveLength(1);
      expect((await s.member.get(`/retirement/records/${created.id}`)).body.id).toBe(created.id);

      const { origin: _origin, ...body } = occupationalPayload({
        providerLabel: 'Neuer Arbeitgeber',
        figures: { guaranteedMonthly: '210.00', expectedMonthly: '300.00' },
      });
      const put = await s.member.put(`/retirement/records/${created.id}`).send(body);
      expect(put.status).toBe(200);
      expect(put.body).toMatchObject({
        id: created.id,
        providerLabel: 'Neuer Arbeitgeber',
        figures: { guaranteedMonthly: '210.00', expectedMonthly: '300.00' },
      });

      expect((await s.member.del(`/retirement/records/${created.id}`)).status).toBe(204);
      expect((await s.member.get(`/retirement/records/${created.id}`)).status).toBe(404);
      expect((await s.member.get('/retirement/records')).body).toEqual([]);
    });

    it('filters by pillar and validates the filter', async () => {
      await create(statutoryPayload());
      await create(occupationalPayload());
      await create(riesterPayload());
      const pillar = async (p: string) =>
        (await s.member.get(`/retirement/records?pillar=${p}`)).body as RetirementRecord[];
      expect((await pillar('STATUTORY')).map((r) => r.contractType)).toEqual(['STATUTORY_PENSION']);
      expect((await pillar('PRIVATE')).map((r) => r.contractType)).toEqual(['RIESTER']);
      expect((await s.member.get('/retirement/records')).body).toHaveLength(3);
      expect((await s.member.get('/retirement/records?pillar=OTHER')).status).toBe(400);
    });

    it('accepts an Altersvorsorgedepot without guarantees', async () => {
      const depot = await create(depotPayload());
      expect(depot).toMatchObject({ pillar: 'PRIVATE', contractType: 'ALTERSVORSORGEDEPOT' });
    });
  });

  describe('validation', () => {
    it('rejects an unknown field with 400 RETIREMENT_UNKNOWN_FIELD naming the field only', async () => {
      const response = await s.member
        .post('/retirement/records')
        .send({ ...riesterPayload(), name: 'Erika Musterfrau' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('RETIREMENT_UNKNOWN_FIELD');
      expect(response.body.details).toEqual([{ field: 'name', message: 'UNKNOWN_FIELD' }]);
      expect(JSON.stringify(response.body)).not.toContain('Musterfrau');
    });

    it('rejects an inapplicable figure (guaranteedMonthly on a depot)', async () => {
      const response = await s.member.post('/retirement/records').send(
        depotPayload({
          figures: { currentValue: '5000.00', guaranteedMonthly: '10.00' } as never,
        }),
      );
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('RETIREMENT_UNKNOWN_FIELD');
    });

    it('names the invalid field and never echoes the value', async () => {
      const response = await s.member.post('/retirement/records').send(
        riesterPayload({
          figures: { guaranteedMonthly: '300.00', expectedMonthly: '150.00' },
        }),
      );
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('RETIREMENT_VALIDATION');
      expect(response.body.details).toEqual([
        { field: 'figures.guaranteedMonthly', message: 'GUARANTEE_ABOVE_EXPECTED' },
      ]);
      expect(JSON.stringify(response.body)).not.toContain('300.00');
    });

    it('rejects manual records that carry import information', async () => {
      const response = await s.member.post('/retirement/records').send({
        ...riesterPayload(),
        import: { parserId: 'x', parserVersion: '1', ocrRead: false },
      });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('RETIREMENT_UNKNOWN_FIELD');
    });

    it('rejects a PUT that tries to change origin or contract type', async () => {
      const created = await create(riesterPayload());
      const origin = await s.member
        .put(`/retirement/records/${created.id}`)
        .send({ ...riesterPayload(), origin: 'IMPORTED' });
      expect(origin.status).toBe(400);
      expect(origin.body.details).toEqual([{ field: 'origin', message: 'UNKNOWN_FIELD' }]);

      const { origin: _origin, ...body } = occupationalPayload();
      const type = await s.member.put(`/retirement/records/${created.id}`).send(body);
      expect(type.status).toBe(400);
      expect(type.body.details).toEqual([{ field: 'contractType', message: 'INVALID_VALUE' }]);
    });
  });

  describe('imported records', () => {
    it('stores figures and supplement and reports the import information', async () => {
      const created = await create(importedRiesterPayload());
      expect(created).toMatchObject({
        origin: 'IMPORTED',
        import: { parserId: 'private-statement', parserVersion: '1', ocrRead: false },
        supplement: { contributionMonthly: '60.00', expectedScenario: '3' },
      });
    });

    it('answers 409 RETIREMENT_IMPORTED_READONLY on PUT', async () => {
      const created = await create(importedRiesterPayload());
      const {
        origin: _origin,
        import: _import,
        supplement: _s,
        ...body
      } = importedRiesterPayload();
      const response = await s.member.put(`/retirement/records/${created.id}`).send(body);
      expect(response.status).toBe(409);
      expect(response.body.error).toBe('RETIREMENT_IMPORTED_READONLY');
    });

    it('edits only the supplement and status through PATCH …/supplement', async () => {
      const created = await create(importedRiesterPayload());
      const response = await s.member
        .patch(`/retirement/records/${created.id}/supplement`)
        .send({ subsidiesYearly: '175.00', status: 'PAID_UP' });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'PAID_UP',
        supplement: { contributionMonthly: '60.00', subsidiesYearly: '175.00' },
        figures: created.figures,
      });
      const bad = await s.member
        .patch(`/retirement/records/${created.id}/supplement`)
        .send({ guaranteedMonthly: '1.00' });
      expect(bad.status).toBe(400);
      expect(bad.body.error).toBe('RETIREMENT_UNKNOWN_FIELD');
    });

    it('answers 409 RETIREMENT_NOT_IMPORTED on PATCH …/supplement of a manual record', async () => {
      const created = await create(riesterPayload());
      const response = await s.member
        .patch(`/retirement/records/${created.id}/supplement`)
        .send({ contributionMonthly: '10.00' });
      expect(response.status).toBe(409);
      expect(response.body.error).toBe('RETIREMENT_NOT_IMPORTED');
    });

    it('rejects an imported record failing a plausibility check with check ids only', async () => {
      const response = await s.member.post('/retirement/records').send(
        importedRiesterPayload({
          figures: {
            guaranteedMonthly: '100.00',
            scenarioMonthly: { '0': '110.00', '3': '90.00', '6': '200.00', '9': '260.00' },
          },
        }),
      );
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('RETIREMENT_CHECK_FAILED');
      expect(response.body.details).toEqual([
        { field: 'SCENARIOS_MONOTONIC', message: 'CHECK_FAILED' },
      ]);
      expect(JSON.stringify(response.body)).not.toContain('110.00');
      expect((await s.member.get('/retirement/records')).body).toEqual([]);
    });
  });

  describe('statutory record', () => {
    it('allows only one without replaces: 409 RETIREMENT_STATUTORY_EXISTS', async () => {
      await create(statutoryPayload());
      const second = await s.member.post('/retirement/records').send(importedStatutoryPayload());
      expect(second.status).toBe(409);
      expect(second.body.error).toBe('RETIREMENT_STATUTORY_EXISTS');
      expect((await s.member.get('/retirement/records')).body).toHaveLength(1);
    });

    it('swaps a manual record for an imported one in one transaction with replaces', async () => {
      const manual = await create(statutoryPayload());
      const swapped = await create(importedStatutoryPayload({ replaces: manual.id }));
      expect(swapped).toMatchObject({ origin: 'IMPORTED', import: { ocrRead: true } });
      expect(swapped.id).not.toBe(manual.id);
      const list = (await s.member.get('/retirement/records')).body as RetirementRecord[];
      expect(list.map((r) => r.id)).toEqual([swapped.id]);
    });

    it('keeps everything when the replaced record is unknown or of another type', async () => {
      const riester = await create(riesterPayload());
      const wrongType = await s.member
        .post('/retirement/records')
        .send(importedStatutoryPayload({ replaces: riester.id }));
      expect(wrongType.status).toBe(404);
      const unknown = await s.member
        .post('/retirement/records')
        .send(importedStatutoryPayload({ replaces: 'does-not-exist' }));
      expect(unknown.status).toBe(404);
      expect((await s.member.get('/retirement/records')).body).toHaveLength(1);
    });

    it('replaces an imported Riester contract with a newer statement', async () => {
      const first = await create(importedRiesterPayload());
      const newer = await create(
        importedRiesterPayload({ statementDate: '2026-05-01', replaces: first.id }),
      );
      const list = (await s.member.get('/retirement/records')).body as RetirementRecord[];
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(newer.id);
    });
  });

  describe('summary', () => {
    it('returns zeros and no pension start for an empty owner', async () => {
      const response = await s.member.get('/retirement/summary');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        expectedMonthly: '0.00',
        guaranteedMonthly: '0.00',
        monthlySavings: '0.00',
        pensionStart: null,
        pillars: { statutory: { count: 0 }, occupational: { count: 0 }, private: { count: 0 } },
      });
    });

    it('totals equal the sums of the caller’s own records only', async () => {
      await create(statutoryPayload());
      await create(riesterPayload());
      await create(occupationalPayload());
      await create(riesterPayload(), s.other);
      const { body } = await s.member.get('/retirement/summary');
      const records = (await s.member.get('/retirement/records')).body as RetirementRecord[];
      expect(body.items).toHaveLength(3);
      expect(body.items.map((i: { id: string }) => i.id).sort()).toEqual(
        records.map((r) => r.id).sort(),
      );
      const sum = (key: 'guaranteedMonthly' | 'expectedMonthly') =>
        body.items.reduce((acc: number, i: Record<string, string>) => acc + Number(i[key]), 0);
      expect(Number(body.guaranteedMonthly)).toBeCloseTo(sum('guaranteedMonthly'), 2);
      expect(Number(body.expectedMonthly)).toBeCloseTo(sum('expectedMonthly'), 2);
      expect(body.pensionStart).toMatchObject({ source: 'STATUTORY' });
    });
  });

  describe('owner isolation', () => {
    it('treats another owner’s record like a missing one on every route', async () => {
      const mine = await create(riesterPayload());
      const id = mine.id;
      expect((await s.other.get(`/retirement/records/${id}`)).status).toBe(404);
      const { origin: _origin, ...body } = riesterPayload();
      expect((await s.other.put(`/retirement/records/${id}`).send(body)).status).toBe(404);
      expect(
        (await s.other.patch(`/retirement/records/${id}/supplement`).send({ status: 'PAID_UP' }))
          .status,
      ).toBe(404);
      expect((await s.other.del(`/retirement/records/${id}`)).status).toBe(404);
      expect((await s.other.get('/retirement/records')).body).toEqual([]);
      // the admin sees only their own data, never another user's
      expect((await s.admin.get('/retirement/records')).body).toEqual([]);
      expect((await s.member.get(`/retirement/records/${id}`)).status).toBe(200);
    });

    it('does not let replaces reach another owner’s record', async () => {
      const mine = await create(statutoryPayload());
      const response = await s.other
        .post('/retirement/records')
        .send(importedStatutoryPayload({ replaces: mine.id }));
      expect(response.status).toBe(404);
      expect((await s.member.get(`/retirement/records/${mine.id}`)).status).toBe(200);
    });

    it('DELETE /retirement purges only the caller’s rows', async () => {
      await create(riesterPayload());
      await create(occupationalPayload());
      const others = await create(riesterPayload(), s.other);
      expect((await s.member.del('/retirement')).status).toBe(204);
      expect((await s.member.get('/retirement/records')).body).toEqual([]);
      expect((await s.other.get(`/retirement/records/${others.id}`)).status).toBe(200);
    });
  });

  describe('encryption at rest', () => {
    it('keeps figures and the identifier out of every stored column', async () => {
      await create(riesterPayload());
      const rows = await t.database.query<Record<string, unknown>>(
        'SELECT * FROM retirement_records',
      );
      expect(rows).toHaveLength(1);
      const stored = JSON.stringify(rows[0]);
      const decoded = Buffer.from(
        String(rows[0]['payload_enc']).split(':').slice(1).join(''),
        'base64',
      ).toString('latin1');
      for (const secret of ['RV-123456', '100.00', '150.00', '175.00', '60.00']) {
        expect(stored).not.toContain(secret);
        expect(decoded).not.toContain(secret);
      }
      expect(rows[0]['payload_enc']).toMatch(/^v1:/);
    });
  });
});

describe('/retirement without RETIREMENT_ENCRYPTION_KEY', () => {
  let t: RetirementTestApp;
  let s: RetirementSessions;

  beforeAll(async () => {
    t = await bootRetirementApp({ key: null });
    s = await signInSessions(t);
  });

  afterAll(async () => {
    await t.close();
  });

  it('answers 503 RETIREMENT_UNAVAILABLE on every route while Holdings still works', async () => {
    const id = 'any-id';
    const { origin: _origin, ...body } = riesterPayload();
    const calls = [
      await s.member.get('/retirement/summary'),
      await s.member.get('/retirement/records'),
      await s.member.get(`/retirement/records/${id}`),
      await s.member.post('/retirement/records').send(riesterPayload()),
      await s.member.put(`/retirement/records/${id}`).send(body),
      await s.member.patch(`/retirement/records/${id}/supplement`).send({}),
      await s.member.del(`/retirement/records/${id}`),
      await s.member.del('/retirement'),
    ];
    for (const response of calls) {
      expect(response.status).toBe(503);
      expect(response.body.error).toBe('RETIREMENT_UNAVAILABLE');
    }
    expect((await s.admin.get('/holdings')).status).toBe(200);
  });
});
