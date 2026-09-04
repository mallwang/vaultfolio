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
 * Integration tests for User Story 2 (per-user data isolation) — T040–T046.
 * Two real accounts (the bootstrap ADMIN and a second MEMBER, inserted
 * directly per quickstart.md Scenario B step 1) sign in for real session
 * cookies; every assertion goes through the live HTTP surface, per
 * Principle IV.
 */
describe('/holdings — per-user isolation (005-auth-sessions-isolation)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let tempDir: string;
  let cookieA: string; // bootstrap admin
  let cookieB: string; // second MEMBER account

  const ADMIN_EMAIL = 'admin@example.com';
  const ADMIN_PASSWORD = 'a-valid-8-char-password';
  const MEMBER_EMAIL = 'member@example.com';
  const MEMBER_PASSWORD = 'another-8-char-password';

  const validGold: CreateHoldingRequest = {
    assetType: 'PRECIOUS_METAL',
    management: 'Home safe',
    name: 'Gold',
    weightGrams: '10',
  };

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-holdings-isolation-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    process.env.BOOTSTRAP_ADMIN_EMAIL = ADMIN_EMAIL;
    process.env.BOOTSTRAP_ADMIN_PASSWORD = ADMIN_PASSWORD;

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    database = moduleRef.get(DatabaseService);

    // Pre-existing (migrated) holding, created before User B exists, to
    // exercise the bootstrap-admin backfill (Acceptance #4/T044).
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .then((res) => {
        cookieA = (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
      });
    await request(app.getHttpServer())
      .post('/holdings')
      .set('Cookie', cookieA)
      .send({
        assetType: 'PRECIOUS_METAL',
        management: 'Legacy vault',
        name: 'Gold',
        weightGrams: '5',
      });

    // Second account, inserted directly — quickstart.md Scenario B step 1
    // ("for this feature alone, a second row may be inserted directly for
    // test purposes", admin-management ships later).
    const argon2 = await import('argon2');
    await database.query(
      `INSERT INTO users (id, email, display_name, password_hash, role)
       VALUES ('member-b', $1, 'Member B', $2, 'MEMBER')`,
      [MEMBER_EMAIL, await argon2.hash(MEMBER_PASSWORD)],
    );
    const signInB = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: MEMBER_EMAIL, password: MEMBER_PASSWORD });
    cookieB = (signInB.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
  });

  afterAll(async () => {
    await app.close();
    delete process.env.DATABASE_PATH;
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const asA = {
    get: (url: string) => request(app.getHttpServer()).get(url).set('Cookie', cookieA),
    post: (url: string) => request(app.getHttpServer()).post(url).set('Cookie', cookieA),
    put: (url: string) => request(app.getHttpServer()).put(url).set('Cookie', cookieA),
  };
  const asB = {
    get: (url: string) => request(app.getHttpServer()).get(url).set('Cookie', cookieB),
  };

  it("T040: a holding created by A is absent from B's list", async () => {
    const created = await request(app.getHttpServer())
      .post('/holdings')
      .set('Cookie', cookieA)
      .send(validGold);
    expect(created.status).toBe(201);

    const listB = await request(app.getHttpServer()).get('/holdings').set('Cookie', cookieB);
    expect(listB.body.some((h: { id: string }) => h.id === created.body.id)).toBe(false);
  });

  it("T041: B editing/deleting A's holding by id gets 404, not 403 (no GET /holdings/:id exists — list is the read surface)", async () => {
    const created = await request(app.getHttpServer())
      .post('/holdings')
      .set('Cookie', cookieA)
      .send(validGold);
    const id = created.body.id;

    const patchResponse = await request(app.getHttpServer())
      .put(`/holdings/${id}`)
      .set('Cookie', cookieB)
      .send({ management: 'Hijacked', weightGrams: '999' });
    expect(patchResponse.status).toBe(404);
    expect(patchResponse.body.error).toBe('HOLDING_NOT_FOUND');

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/holdings/${id}`)
      .set('Cookie', cookieB);
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.body.error).toBe('HOLDING_NOT_FOUND');
  });

  it("T042: A's edits/deletes affect only A's holdings, not B's", async () => {
    const aHolding = await request(app.getHttpServer())
      .post('/holdings')
      .set('Cookie', cookieA)
      .send(validGold);
    const bHolding = await request(app.getHttpServer())
      .post('/holdings')
      .set('Cookie', cookieB)
      .send({
        assetType: 'PRECIOUS_METAL',
        management: "B's safe",
        name: 'Gold',
        weightGrams: '20',
      });

    await request(app.getHttpServer())
      .put(`/holdings/${aHolding.body.id}`)
      .set('Cookie', cookieA)
      .send({ management: 'Updated', weightGrams: '15' });
    await request(app.getHttpServer())
      .delete(`/holdings/${aHolding.body.id}`)
      .set('Cookie', cookieA);

    const listB = await request(app.getHttpServer()).get('/holdings').set('Cookie', cookieB);
    expect(listB.body.some((h: { id: string }) => h.id === bHolding.body.id)).toBe(true);
  });

  it("T043: GET /holdings (the only aggregate/list surface) reflects only the requester's holdings", async () => {
    await request(app.getHttpServer()).post('/holdings').set('Cookie', cookieA).send(validGold);

    const listA = await asA.get('/holdings');
    const listB = await asB.get('/holdings');

    const idsA = new Set((listA.body as { id: string }[]).map((h) => h.id));
    const idsB = new Set((listB.body as { id: string }[]).map((h) => h.id));
    expect([...idsA].some((id) => idsB.has(id))).toBe(false);
  });

  it('T044: pre-existing migrated holdings are visible to the bootstrap admin, invisible to a second MEMBER', async () => {
    const listA = await asA.get('/holdings');
    const listB = await asB.get('/holdings');

    expect(
      (listA.body as { management: string }[]).some((h) => h.management === 'Legacy vault'),
    ).toBe(true);
    expect(
      (listB.body as { management: string }[]).some((h) => h.management === 'Legacy vault'),
    ).toBe(false);
  });

  it("T045: an ADMIN reading another user's holding by id still 404s (role never implies cross-user access)", async () => {
    const bHolding = await request(app.getHttpServer())
      .post('/holdings')
      .set('Cookie', cookieB)
      .send({
        assetType: 'PRECIOUS_METAL',
        management: "B's private",
        name: 'Gold',
        weightGrams: '1',
      });

    const response = await request(app.getHttpServer())
      .put(`/holdings/${bHolding.body.id}`)
      .set('Cookie', cookieA)
      .send({ management: 'Admin override', weightGrams: '2' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('HOLDING_NOT_FOUND');
  });

  it('T046: no response body (list, create, update) ever contains an owner_id/ownerId field (FR-010)', async () => {
    const created = await asA.post('/holdings').send(validGold);
    const list = await asA.get('/holdings');
    const updated = await asA
      .put(`/holdings/${created.body.id}`)
      .send({ management: 'Renamed', weightGrams: '11' });

    for (const body of [created.body, updated.body, ...(list.body as unknown[])]) {
      expect(body).not.toHaveProperty('owner_id');
      expect(body).not.toHaveProperty('ownerId');
    }
  });
});
