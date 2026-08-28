import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { CreateHoldingRequest } from 'api-contract';
import { AppModule } from '../app/app.module';
import { DatabaseService } from '../database/database.service';

/**
 * Integration test for `/holdings` (contracts/holdings-api.md). Issues real
 * HTTP requests against a running Nest app instance via `supertest` — not an
 * in-memory call — with a real Postgres connection, per Principle IV.
 * Requires the local dev stack's database to be reachable (see
 * quickstart.md's Prerequisites).
 */
describe('/holdings', () => {
  let app: INestApplication;
  let database: DatabaseService;

  const validEtf: CreateHoldingRequest = {
    assetType: 'ETF',
    management: 'Roboadvisor',
    isin: 'IE00B4L5Y983',
    name: 'iShares Core MSCI World',
    quantity: '12.5',
    purchasePrice: '78.42',
  };

  const validShare: CreateHoldingRequest = {
    assetType: 'SHARE',
    management: 'Private',
    isin: 'US0378331005',
    name: 'Apple Inc.',
    quantity: '10',
    purchasePrice: '150.00',
  };

  const validGold: CreateHoldingRequest = {
    assetType: 'GOLD',
    management: 'Private',
    weightGrams: '31.1',
  };

  const validBitcoin: CreateHoldingRequest = {
    assetType: 'BITCOIN',
    management: 'Private',
    quantity: '0.25',
    purchasePrice: '42000.00',
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    database = moduleRef.get(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Isolate each test from previously inserted rows (no auth/tenancy in
    // this feature, per spec.md Assumptions — the whole table is this
    // "user"'s dataset).
    await database.query('DELETE FROM holdings');
  });

  describe('GET /holdings', () => {
    it('returns 200 with an empty array against a clean database (FR-013)', async () => {
      const response = await request(app.getHttpServer()).get('/holdings');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('returns all created holdings with the exact field shape (FR-012, FR-013)', async () => {
      for (const body of [validEtf, validShare, validGold, validBitcoin]) {
        await request(app.getHttpServer()).post('/holdings').send(body);
      }

      const response = await request(app.getHttpServer()).get('/holdings');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(4);
      const assetTypes = (response.body as { assetType: string }[])
        .map((holding) => holding.assetType)
        .sort();
      expect(assetTypes).toEqual(['BITCOIN', 'ETF', 'GOLD', 'SHARE']);
      for (const holding of response.body as Record<string, unknown>[]) {
        expect(typeof holding.id).toBe('string');
        expect(typeof holding.createdAt).toBe('string');
        expect(typeof holding.updatedAt).toBe('string');
      }
    });
  });

  describe('POST /holdings — success + upsert-vs-new-lot (FR-001, FR-011, FR-011a)', () => {
    it('creates a new row for each of the four asset types, asserting 201 and the response shape', async () => {
      for (const body of [validEtf, validShare, validGold, validBitcoin]) {
        const response = await request(app.getHttpServer()).post('/holdings').send(body);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          assetType: body.assetType,
          management: body.management,
        });
        expect(typeof response.body.id).toBe('string');
      }
    });

    it('replaces the existing row in place on a second matching ETF submission (200, same id, no duplicate)', async () => {
      const first = await request(app.getHttpServer()).post('/holdings').send(validEtf);
      expect(first.status).toBe(201);
      const originalId = first.body.id;

      const second = await request(app.getHttpServer())
        .post('/holdings')
        .send({ ...validEtf, quantity: '20', purchasePrice: '90.00' });

      expect(second.status).toBe(200);
      expect(second.body.id).toBe(originalId);
      expect(second.body.quantity).toBe('20');
      expect(second.body.purchasePrice).toBe('90');

      const list = await request(app.getHttpServer()).get('/holdings');
      expect(list.body).toHaveLength(1);
    });

    it('replaces the existing row in place on a second matching Gold submission (200, same id, no duplicate)', async () => {
      const first = await request(app.getHttpServer()).post('/holdings').send(validGold);
      expect(first.status).toBe(201);
      const originalId = first.body.id;

      const second = await request(app.getHttpServer())
        .post('/holdings')
        .send({ ...validGold, weightGrams: '50' });

      expect(second.status).toBe(200);
      expect(second.body.id).toBe(originalId);
      expect(second.body.weightGrams).toBe('50');

      const list = await request(app.getHttpServer()).get('/holdings');
      expect(list.body).toHaveLength(1);
    });

    it('creates a second, distinct row for a repeat Share submission (201, distinct id, no merge)', async () => {
      const first = await request(app.getHttpServer()).post('/holdings').send(validShare);
      const second = await request(app.getHttpServer())
        .post('/holdings')
        .send({ ...validShare, quantity: '5' });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body.id).not.toBe(first.body.id);

      const list = await request(app.getHttpServer()).get('/holdings');
      expect(list.body).toHaveLength(2);
    });

    it('creates a second, distinct row for a repeat Bitcoin submission (201, distinct id, no merge)', async () => {
      const first = await request(app.getHttpServer()).post('/holdings').send(validBitcoin);
      const second = await request(app.getHttpServer())
        .post('/holdings')
        .send({ ...validBitcoin, quantity: '0.5' });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body.id).not.toBe(first.body.id);
    });

    it('creates a separate row for the same ETF isin under a different Management value (FR-011a)', async () => {
      await request(app.getHttpServer()).post('/holdings').send(validEtf);
      const second = await request(app.getHttpServer())
        .post('/holdings')
        .send({ ...validEtf, management: 'Private' });

      expect(second.status).toBe(201);

      const list = await request(app.getHttpServer()).get('/holdings');
      expect(list.body).toHaveLength(2);
    });
  });

  describe('POST /holdings — validation failures (FR-009, FR-010, SC-002)', () => {
    const expectFieldError = async (body: unknown, field: string) => {
      const response = await request(app.getHttpServer()).post('/holdings').send(body);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_FAILED');
      expect(response.body.fieldErrors).toContainEqual(expect.objectContaining({ field }));
    };

    it('rejects negative quantity', () =>
      expectFieldError({ ...validShare, quantity: '-1' }, 'quantity'));

    it('rejects negative purchasePrice', () =>
      expectFieldError({ ...validShare, purchasePrice: '-1' }, 'purchasePrice'));

    it('rejects negative weight for Gold', () =>
      expectFieldError({ ...validGold, weightGrams: '-1' }, 'weightGrams'));

    it('rejects negative currentValue for Gold', () =>
      expectFieldError({ ...validGold, currentValue: '-1' }, 'currentValue'));

    it('rejects a future purchase date', async () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      await expectFieldError(
        { ...validShare, purchaseDate: future.toISOString().slice(0, 10) },
        'purchaseDate',
      );
    });

    it('rejects a malformed ISIN', () =>
      expectFieldError({ ...validShare, isin: 'NOT-AN-ISIN' }, 'isin'));

    it('rejects a missing Management value', () =>
      expectFieldError({ ...validShare, management: '' }, 'management'));

    it('rejects a missing required type-specific field (ETF isin)', async () => {
      const { isin: _isin, ...withoutIsin } = validEtf;
      await expectFieldError(withoutIsin, 'isin');
    });

    it('rejects extraneous fields for the wrong type (Gold with isin)', () =>
      expectFieldError({ ...validGold, isin: 'US0378331005' }, 'isin'));

    it('reports every failing field at once, not just the first', async () => {
      const response = await request(app.getHttpServer())
        .post('/holdings')
        .send({ assetType: 'SHARE', management: '', isin: 'INVALID', quantity: '-1' });

      expect(response.status).toBe(400);
      const fields = (response.body.fieldErrors as { field: string }[]).map((e) => e.field);
      expect(fields).toEqual(expect.arrayContaining(['management', 'isin', 'quantity', 'name']));
    });
  });

  describe('PUT /holdings/:id (FR-014)', () => {
    it('edits a field and round-trips it on GET, leaving other holdings untouched', async () => {
      const created = await request(app.getHttpServer()).post('/holdings').send(validShare);
      const other = await request(app.getHttpServer()).post('/holdings').send(validBitcoin);

      const updated = await request(app.getHttpServer())
        .put(`/holdings/${created.body.id}`)
        .send({
          management: validShare.management,
          isin: (validShare as { isin: string }).isin,
          name: (validShare as { name: string }).name,
          quantity: '99',
          purchasePrice: (validShare as { purchasePrice: string }).purchasePrice,
        });

      expect(updated.status).toBe(200);
      expect(updated.body.quantity).toBe('99');
      expect(updated.body.id).toBe(created.body.id);

      const list = await request(app.getHttpServer()).get('/holdings');
      const persisted = (list.body as { id: string; quantity: string }[]).find(
        (h) => h.id === created.body.id,
      );
      expect(persisted?.quantity).toBe('99');
      const untouched = (list.body as { id: string }[]).find((h) => h.id === other.body.id);
      expect(untouched).toBeDefined();
    });

    it('returns the same 400 fieldErrors shape as POST on invalid input', async () => {
      const created = await request(app.getHttpServer()).post('/holdings').send(validShare);

      const response = await request(app.getHttpServer())
        .put(`/holdings/${created.body.id}`)
        .send({
          management: validShare.management,
          isin: (validShare as { isin: string }).isin,
          name: (validShare as { name: string }).name,
          quantity: '-1',
          purchasePrice: (validShare as { purchasePrice: string }).purchasePrice,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_FAILED');
    });

    it('returns 404 HOLDING_NOT_FOUND for a non-existent id', async () => {
      const response = await request(app.getHttpServer())
        .put('/holdings/00000000-0000-0000-0000-000000000000')
        .send({ management: 'Private', quantity: '1', purchasePrice: '1' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('HOLDING_NOT_FOUND');
    });
  });

  describe('DELETE /holdings/:id (FR-016)', () => {
    it('deletes a holding, asserting 204 then absence from a subsequent GET, and 404 on repeat delete', async () => {
      const created = await request(app.getHttpServer()).post('/holdings').send(validBitcoin);

      const deleted = await request(app.getHttpServer()).delete(`/holdings/${created.body.id}`);
      expect(deleted.status).toBe(204);

      const list = await request(app.getHttpServer()).get('/holdings');
      expect((list.body as { id: string }[]).some((h) => h.id === created.body.id)).toBe(false);

      const secondDelete = await request(app.getHttpServer()).delete(
        `/holdings/${created.body.id}`,
      );
      expect(secondDelete.status).toBe(404);
      expect(secondDelete.body.error).toBe('HOLDING_NOT_FOUND');
    });
  });
});
