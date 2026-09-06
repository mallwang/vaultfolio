import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { CreateAccountOverviewEntryRequest } from '@vaultfolio/api-contract';
import { AppModule } from '../app/app.module';

/**
 * Full HTTP round-trip against a real temp SQLite file — create -> appears in
 * list -> edit -> delete, plus the blank-name 400 and not-found 404 cases,
 * mirroring `holdings-persistence.e2e-spec.ts` (Principle IV).
 */
describe('/account-overview/accounts', () => {
  let app: INestApplication;
  let tempDir: string;
  let cookie: string;

  const ADMIN_EMAIL = 'admin@example.com';
  const ADMIN_PASSWORD = 'a-valid-8-char-password';

  const validAccount: CreateAccountOverviewEntryRequest = {
    name: 'N26 checking',
    category: 'GENERAL',
    provider: 'N26',
    website: 'https://n26.com',
    purpose: 'Everyday spending',
  };

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-account-overview-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    process.env.BOOTSTRAP_ADMIN_EMAIL = ADMIN_EMAIL;
    process.env.BOOTSTRAP_ADMIN_PASSWORD = ADMIN_PASSWORD;

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const signIn = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    cookie = (signIn.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
  });

  afterAll(async () => {
    await app.close();
    delete process.env.DATABASE_PATH;
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('GET /account-overview/accounts returns an empty array when the user has none', async () => {
    const response = await request(app.getHttpServer())
      .get('/account-overview/accounts')
      .set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('POST creates an account (201), it appears in the list, is edited (200), then deleted (204)', async () => {
    const created = await request(app.getHttpServer())
      .post('/account-overview/accounts')
      .set('Cookie', cookie)
      .send(validAccount);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: 'N26 checking',
      category: 'GENERAL',
      provider: 'N26',
      website: 'https://n26.com',
      purpose: 'Everyday spending',
      cardUsage: null,
      requiredMinimum: null,
      notes: null,
    });
    const id = created.body.id;

    const list = await request(app.getHttpServer())
      .get('/account-overview/accounts')
      .set('Cookie', cookie);
    expect(list.body.some((entry: { id: string }) => entry.id === id)).toBe(true);

    const updated = await request(app.getHttpServer())
      .put(`/account-overview/accounts/${id}`)
      .set('Cookie', cookie)
      .send({ category: 'CREDIT_CARD', purpose: 'Card usage' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id,
      name: 'N26 checking',
      category: 'CREDIT_CARD',
      purpose: 'Card usage',
      // fields omitted from the PUT body keep their previous stored value.
      provider: 'N26',
      website: 'https://n26.com',
    });

    const deleted = await request(app.getHttpServer())
      .delete(`/account-overview/accounts/${id}`)
      .set('Cookie', cookie);
    expect(deleted.status).toBe(204);

    const listAfterDelete = await request(app.getHttpServer())
      .get('/account-overview/accounts')
      .set('Cookie', cookie);
    expect(listAfterDelete.body.some((entry: { id: string }) => entry.id === id)).toBe(false);
  });

  it('POST creates a credit card account with cardNumber/validUntil, then rejects a malformed edit', async () => {
    const created = await request(app.getHttpServer())
      .post('/account-overview/accounts')
      .set('Cookie', cookie)
      .send({
        name: 'Amex Gold',
        category: 'CREDIT_CARD',
        cardNumber: '3782 822463 10005',
        validUntil: '09/28',
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      cardNumber: '3782 822463 10005',
      validUntil: '09/28',
    });

    const badEdit = await request(app.getHttpServer())
      .put(`/account-overview/accounts/${created.body.id}`)
      .set('Cookie', cookie)
      .send({ validUntil: '2028' });
    expect(badEdit.status).toBe(400);
    expect(badEdit.body.fieldErrors).toContainEqual(
      expect.objectContaining({ field: 'validUntil' }),
    );

    await request(app.getHttpServer())
      .delete(`/account-overview/accounts/${created.body.id}`)
      .set('Cookie', cookie);
  });

  it('POST with a blank name returns 400 VALIDATION_FAILED', async () => {
    const response = await request(app.getHttpServer())
      .post('/account-overview/accounts')
      .set('Cookie', cookie)
      .send({ name: '   ' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_FAILED');
    expect(response.body.fieldErrors).toContainEqual(expect.objectContaining({ field: 'name' }));
  });

  it('POST with only a name defaults category to OTHER (FR-007/FR-008) and status to ACTIVE', async () => {
    const response = await request(app.getHttpServer())
      .post('/account-overview/accounts')
      .set('Cookie', cookie)
      .send({ name: 'Minimal account' });
    expect(response.status).toBe(201);
    expect(response.body.category).toBe('OTHER');
    expect(response.body.status).toBe('ACTIVE');
    expect(response.body.provider).toBeNull();
  });

  it('POST creates a decommissioned account, then PUT can reactivate it', async () => {
    const created = await request(app.getHttpServer())
      .post('/account-overview/accounts')
      .set('Cookie', cookie)
      .send({ name: 'Closed depot', status: 'DECOMMISSIONED' });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('DECOMMISSIONED');

    const updated = await request(app.getHttpServer())
      .put(`/account-overview/accounts/${created.body.id}`)
      .set('Cookie', cookie)
      .send({ status: 'ACTIVE' });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('ACTIVE');

    await request(app.getHttpServer())
      .delete(`/account-overview/accounts/${created.body.id}`)
      .set('Cookie', cookie);
  });

  it('POST with an unrecognized status returns 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/account-overview/accounts')
      .set('Cookie', cookie)
      .send({ name: 'Bad status', status: 'CLOSED' });
    expect(response.status).toBe(400);
    expect(response.body.fieldErrors).toContainEqual(expect.objectContaining({ field: 'status' }));
  });

  it('POST with an unrecognized category returns 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/account-overview/accounts')
      .set('Cookie', cookie)
      .send({ name: 'Bad category', category: 'CRYPTO' });
    expect(response.status).toBe(400);
    expect(response.body.fieldErrors).toContainEqual(
      expect.objectContaining({ field: 'category' }),
    );
  });

  it('PUT a nonexistent id returns 404 ACCOUNT_NOT_FOUND', async () => {
    const response = await request(app.getHttpServer())
      .put('/account-overview/accounts/does-not-exist')
      .set('Cookie', cookie)
      .send({ name: 'X' });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'ACCOUNT_NOT_FOUND',
      message: 'This account no longer exists.',
    });
  });

  it('DELETE a nonexistent id returns 404 ACCOUNT_NOT_FOUND', async () => {
    const response = await request(app.getHttpServer())
      .delete('/account-overview/accounts/does-not-exist')
      .set('Cookie', cookie);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'ACCOUNT_NOT_FOUND',
      message: 'This account no longer exists.',
    });
  });
});
