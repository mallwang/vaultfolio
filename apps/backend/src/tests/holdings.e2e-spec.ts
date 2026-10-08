import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { CreateHoldingRequest } from '@vaultfolio/api-contract';
import { AppModule } from '../app/app.module';
import { DatabaseService } from '../database/database.service';

/**
 * Integration test for `/holdings` (contracts/holdings-api.md). Issues real
 * HTTP requests against a running Nest app instance via `supertest` — not an
 * in-memory call — against a per-test-run temp-file SQLite database, per
 * Principle IV and research.md #8 (isolated from both other test runs and any
 * developer's real `./data` directory).
 *
 * 005-auth-sessions-isolation: every route is authenticated by default, so
 * each request carries the bootstrap admin's session cookie, obtained once
 * in `beforeAll` (FR-001).
 */
describe('/holdings', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let tempDir: string;
  let cookie: string;

  const ADMIN_EMAIL = 'admin@example.com';
  const ADMIN_PASSWORD = 'a-valid-8-char-password';

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
    assetType: 'PRECIOUS_METAL',
    management: 'Private',
    metal: 'XAU',
    quantity: '31.1',
    unit: 'G',
  };

  const validBitcoin: CreateHoldingRequest = {
    assetType: 'CRYPTO',
    management: 'Private',
    coinId: 'bitcoin',
    quantity: '0.25',
    purchasePrice: '42000.00',
  };

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-holdings-e2e-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
    process.env.BOOTSTRAP_ADMIN_EMAIL = ADMIN_EMAIL;
    process.env.BOOTSTRAP_ADMIN_PASSWORD = ADMIN_PASSWORD;

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    database = moduleRef.get(DatabaseService);

    const signIn = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const setCookie = signIn.headers['set-cookie'] as unknown as string[];
    cookie = setCookie[0].split(';')[0];
  });

  afterAll(async () => {
    await app.close();
    delete process.env.DATABASE_PATH;
    delete process.env.ENCRYPTION_KEY;
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Isolate each test from previously inserted rows — this feature's
    // "one user's dataset" is now the bootstrap admin's, scoped by owner_id.
    await database.query('DELETE FROM holdings');
  });

  const agent = () => request(app.getHttpServer());
  const get = (url: string) => agent().get(url).set('Cookie', cookie);
  const post = (url: string) => agent().post(url).set('Cookie', cookie);
  const put = (url: string) => agent().put(url).set('Cookie', cookie);
  const del = (url: string) => agent().delete(url).set('Cookie', cookie);

  describe('GET /holdings', () => {
    it('returns 200 with an empty array against a clean database (FR-013)', async () => {
      const response = await get('/holdings');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('returns all created holdings with the exact field shape (FR-012, FR-013)', async () => {
      for (const body of [validEtf, validShare, validGold, validBitcoin]) {
        await post('/holdings').send(body);
      }

      const response = await get('/holdings');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(4);
      const assetTypes = (response.body as { assetType: string }[])
        .map((holding) => holding.assetType)
        .sort();
      expect(assetTypes).toEqual(['CRYPTO', 'ETF', 'PRECIOUS_METAL', 'SHARE']);
      for (const holding of response.body as Record<string, unknown>[]) {
        expect(typeof holding.id).toBe('string');
        expect(typeof holding.createdAt).toBe('string');
        expect(typeof holding.updatedAt).toBe('string');
        expect(holding.owner_id).toBeUndefined();
        expect(holding.ownerId).toBeUndefined();
      }
    });
  });

  describe('POST /holdings — success + upsert-vs-new-lot (FR-001, FR-011, FR-011a)', () => {
    it('creates a new row for each of the four asset types, asserting 201 and the response shape', async () => {
      for (const body of [validEtf, validShare, validGold, validBitcoin]) {
        const response = await post('/holdings').send(body);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          assetType: body.assetType,
          management: body.management,
        });
        expect(typeof response.body.id).toBe('string');
      }
    });

    it('replaces the existing row in place on a second matching ETF submission (200, same id, no duplicate)', async () => {
      const first = await post('/holdings').send(validEtf);
      expect(first.status).toBe(201);
      const originalId = first.body.id;

      const second = await post('/holdings').send({
        ...validEtf,
        quantity: '20',
        purchasePrice: '90.00',
      });

      expect(second.status).toBe(200);
      expect(second.body.id).toBe(originalId);
      expect(second.body.quantity).toBe('20');
      expect(second.body.purchasePrice).toBe('90');

      const list = await get('/holdings');
      expect(list.body).toHaveLength(1);
    });

    it('merges a repeat Precious metal submission with the same metal and management (200, same id, no duplicate)', async () => {
      const first = await post('/holdings').send(validGold);
      expect(first.status).toBe(201);

      const second = await post('/holdings').send({ ...validGold, quantity: '50' });

      expect(second.status).toBe(200);
      expect(second.body.id).toBe(first.body.id);
      expect(second.body.quantity).toBe('50');
      expect(second.body.createdAt).toBe(first.body.createdAt);
      expect((await get('/holdings')).body).toHaveLength(1);
    });

    it('creates a second, distinct row for a repeat Share submission (201, distinct id, no merge)', async () => {
      const first = await post('/holdings').send(validShare);
      const second = await post('/holdings').send({ ...validShare, quantity: '5' });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body.id).not.toBe(first.body.id);

      const list = await get('/holdings');
      expect(list.body).toHaveLength(2);
    });

    it('creates a second, distinct row for a repeat Crypto submission (201, distinct id, no merge)', async () => {
      const first = await post('/holdings').send(validBitcoin);
      const second = await post('/holdings').send({ ...validBitcoin, quantity: '0.5' });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body.id).not.toBe(first.body.id);
    });

    it('creates a separate row for the same ETF isin under a different Management value (FR-011a)', async () => {
      await post('/holdings').send(validEtf);
      const second = await post('/holdings').send({ ...validEtf, management: 'Private' });

      expect(second.status).toBe(201);

      const list = await get('/holdings');
      expect(list.body).toHaveLength(2);
    });

    it('keeps different metals under the same management apart (201 then 201)', async () => {
      const gold = await post('/holdings').send(validGold);
      const silver = await post('/holdings').send({ ...validGold, metal: 'XAG' });

      expect(gold.status).toBe(201);
      expect(silver.status).toBe(201);
      expect(silver.body.id).not.toBe(gold.body.id);
      expect((await get('/holdings')).body).toHaveLength(2);
    });

    it('merges Deposit money by normalised name and management (201 then 200)', async () => {
      const deposit = {
        assetType: 'DEPOSIT_MONEY',
        management: 'N26',
        name: 'Tagesgeld',
        currentValue: '100',
      };
      const first = await post('/holdings').send(deposit);
      const second = await post('/holdings').send({
        ...deposit,
        name: '  tagesgeld ',
        currentValue: '250.5',
      });

      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.body.id).toBe(first.body.id);
      expect(second.body.currentValue).toBe('250.5');
    });
  });

  describe('POST /holdings — validation failures (FR-009, FR-010, SC-002)', () => {
    const expectFieldError = async (body: Record<string, unknown>, field: string, code: string) => {
      const response = await post('/holdings').send(body);

      expect(response.status).toBe(400);
      expect(response.body.errors).toContainEqual({ field, code });
    };

    it('rejects negative quantity', () =>
      expectFieldError({ ...validShare, quantity: '-1' }, 'quantity', 'QUANTITY_NOT_POSITIVE'));

    it('rejects negative purchasePrice', () =>
      expectFieldError({ ...validShare, purchasePrice: '-1' }, 'purchasePrice', 'DECIMAL_INVALID'));

    it('rejects negative currentValue for Deposit money', () =>
      expectFieldError(
        { assetType: 'DEPOSIT_MONEY', management: 'N26', name: 'x', currentValue: '-1' },
        'currentValue',
        'DECIMAL_INVALID',
      ));

    it('rejects an unknown metal', () =>
      expectFieldError({ ...validGold, metal: 'XXX' }, 'metal', 'METAL_UNKNOWN'));

    it('rejects an invalid unit', () =>
      expectFieldError({ ...validGold, unit: 'KG' }, 'unit', 'UNIT_INVALID'));

    it('rejects an unknown coin', () =>
      expectFieldError({ ...validBitcoin, coinId: 'nope' }, 'coinId', 'COIN_UNKNOWN'));

    it('rejects more than 8 decimals for Crypto quantity', () =>
      expectFieldError(
        { ...validBitcoin, quantity: '0.123456789' },
        'quantity',
        'QUANTITY_DECIMALS',
      ));

    it('rejects a note over 500 characters', () =>
      expectFieldError({ ...validShare, note: 'x'.repeat(501) }, 'note', 'NOTE_TOO_LONG'));

    it('rejects a future purchase date', async () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      await expectFieldError(
        { ...validShare, purchaseDate: future.toISOString().slice(0, 10) },
        'purchaseDate',
        'DECIMAL_INVALID',
      );
    });

    it('rejects a malformed ISIN', () =>
      expectFieldError({ ...validShare, isin: 'NOT-AN-ISIN' }, 'isin', 'ISIN_INVALID'));

    it('rejects a missing Management value', () =>
      expectFieldError({ ...validShare, management: '' }, 'management', 'REQUIRED'));

    it('rejects a missing required type-specific field (ETF isin)', async () => {
      const { isin: _isin, ...withoutIsin } = validEtf;
      await expectFieldError(withoutIsin, 'isin', 'REQUIRED');
    });

    it('rejects an isin on Precious metal', () =>
      expectFieldError({ ...validGold, isin: 'US0378331005' }, 'isin', 'ISIN_NOT_ALLOWED'));

    it('rejects a metal on a Share', () =>
      expectFieldError({ ...validShare, metal: 'XAU' }, 'metal', 'FIELD_NOT_ALLOWED'));

    it('reports every failing field at once, not just the first', async () => {
      const response = await post('/holdings').send({
        assetType: 'SHARE',
        management: '',
        isin: 'INVALID',
        quantity: '-1',
      });

      expect(response.status).toBe(400);
      const fields = (response.body.errors as { field: string }[]).map((e) => e.field);
      expect(fields).toEqual(expect.arrayContaining(['management', 'isin', 'quantity', 'name']));
    });

    it('rejects an unknown asset type', () =>
      expectFieldError({ assetType: 'GOLD', management: 'Private' }, 'assetType', 'REQUIRED'));
  });

  describe('PUT /holdings/:id (FR-014)', () => {
    it('edits a field and round-trips it on GET, leaving other holdings untouched', async () => {
      const created = await post('/holdings').send(validShare);
      const other = await post('/holdings').send(validBitcoin);

      const updated = await put(`/holdings/${created.body.id}`).send({
        management: validShare.management,
        isin: (validShare as { isin: string }).isin,
        name: (validShare as { name: string }).name,
        quantity: '99',
        purchasePrice: (validShare as { purchasePrice: string }).purchasePrice,
      });

      expect(updated.status).toBe(200);
      expect(updated.body.quantity).toBe('99');
      expect(updated.body.id).toBe(created.body.id);

      const list = await get('/holdings');
      const persisted = (list.body as { id: string; quantity: string }[]).find(
        (h) => h.id === created.body.id,
      );
      expect(persisted?.quantity).toBe('99');
      const untouched = (list.body as { id: string }[]).find((h) => h.id === other.body.id);
      expect(untouched).toBeDefined();
    });

    it('returns the same 400 errors shape as POST on invalid input', async () => {
      const created = await post('/holdings').send(validShare);

      const response = await put(`/holdings/${created.body.id}`).send({
        management: validShare.management,
        isin: (validShare as { isin: string }).isin,
        name: (validShare as { name: string }).name,
        quantity: '-1',
        purchasePrice: (validShare as { purchasePrice: string }).purchasePrice,
      });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual([{ field: 'quantity', code: 'QUANTITY_NOT_POSITIVE' }]);
    });

    it('rejects an assetType change (400 FIELD_NOT_ALLOWED on assetType)', async () => {
      const created = await post('/holdings').send(validShare);
      const response = await put(`/holdings/${created.body.id}`).send({
        ...validShare,
        assetType: 'ETF',
      });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual([{ field: 'assetType', code: 'FIELD_NOT_ALLOWED' }]);
    });

    it('returns 404 HOLDING_NOT_FOUND for a non-existent id', async () => {
      const response = await put('/holdings/00000000-0000-0000-0000-000000000000').send({
        management: 'Private',
        quantity: '1',
        purchasePrice: '1',
      });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('HOLDING_NOT_FOUND');
    });
  });

  describe('encryption at rest', () => {
    it('stores no plaintext in the holdings table', async () => {
      await post('/holdings').send({ ...validShare, note: 'very private note' });
      const rows = await database.query<{ payload_enc: string; key_version: number }>(
        'SELECT payload_enc, key_version FROM holdings',
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].key_version).toBe(2);
      expect(rows[0].payload_enc).not.toContain('Apple');
      expect(rows[0].payload_enc).not.toContain('very private note');
    });
  });

  describe('DELETE /holdings/:id (FR-016)', () => {
    it('deletes a holding, asserting 204 then absence from a subsequent GET, and 404 on repeat delete', async () => {
      const created = await post('/holdings').send(validBitcoin);

      const deleted = await del(`/holdings/${created.body.id}`);
      expect(deleted.status).toBe(204);

      const list = await get('/holdings');
      expect((list.body as { id: string }[]).some((h) => h.id === created.body.id)).toBe(false);

      const secondDelete = await del(`/holdings/${created.body.id}`);
      expect(secondDelete.status).toBe(404);
      expect(secondDelete.body.error).toBe('HOLDING_NOT_FOUND');
    });
  });
});
