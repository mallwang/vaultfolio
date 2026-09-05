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
import { UsersRepository } from '../auth/users.repository';

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
    await request(app.getHttpServer()).post('/holdings').set('Cookie', cookieA).send({
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

/**
 * Integration tests for 018-deposit-money: POST/GET behavior, validation
 * (required fields, extraneous fields, the currentValue >= 0 boundary), and
 * upsert-in-place on repeated `(name, management)` submissions (User Stories
 * 1 & 2), per contracts/holdings-api-deposit-money.md.
 */
describe('/holdings — deposit money (018-deposit-money)', () => {
  let app: INestApplication;
  let tempDir: string;
  let cookie: string;

  const ADMIN_EMAIL = 'admin@example.com';
  const ADMIN_PASSWORD = 'a-valid-8-char-password';

  const validDeposit: CreateHoldingRequest = {
    assetType: 'DEPOSIT_MONEY',
    management: 'N26',
    name: 'N26 checking',
    currentValue: '1250.00',
  };

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-holdings-deposit-money-'));
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

  it('T012: POST /holdings with a valid DEPOSIT_MONEY body returns 201, and GET /holdings includes it', async () => {
    const created = await request(app.getHttpServer())
      .post('/holdings')
      .set('Cookie', cookie)
      .send(validDeposit);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      assetType: 'DEPOSIT_MONEY',
      management: 'N26',
      name: 'N26 checking',
      currentValue: '1250',
    });

    const list = await request(app.getHttpServer()).get('/holdings').set('Cookie', cookie);
    expect((list.body as { id: string }[]).some((holding) => holding.id === created.body.id)).toBe(
      true,
    );
  });

  it('T013: POST /holdings with DEPOSIT_MONEY rejects missing name/currentValue, negative currentValue, and extraneous fields; accepts currentValue "0"', async () => {
    const missingName = await request(app.getHttpServer())
      .post('/holdings')
      .set('Cookie', cookie)
      .send({ assetType: 'DEPOSIT_MONEY', management: 'N26', currentValue: '100' });
    expect(missingName.status).toBe(400);
    expect(missingName.body.error).toBe('VALIDATION_FAILED');
    expect(missingName.body.fieldErrors).toContainEqual(expect.objectContaining({ field: 'name' }));

    const missingCurrentValue = await request(app.getHttpServer())
      .post('/holdings')
      .set('Cookie', cookie)
      .send({ assetType: 'DEPOSIT_MONEY', management: 'N26', name: 'Checking' });
    expect(missingCurrentValue.status).toBe(400);
    expect(missingCurrentValue.body.fieldErrors).toContainEqual(
      expect.objectContaining({ field: 'currentValue' }),
    );

    const negative = await request(app.getHttpServer())
      .post('/holdings')
      .set('Cookie', cookie)
      .send({ ...validDeposit, currentValue: '-5' });
    expect(negative.status).toBe(400);
    expect(negative.body.fieldErrors).toContainEqual(
      expect.objectContaining({ field: 'currentValue' }),
    );

    const zero = await request(app.getHttpServer())
      .post('/holdings')
      .set('Cookie', cookie)
      .send({ ...validDeposit, management: 'ZeroBank', currentValue: '0' });
    expect(zero.status).toBe(201);

    for (const [field, value] of [
      ['isin', 'US0378331005'],
      ['quantity', '1'],
      ['purchasePrice', '1'],
      ['purchaseDate', '2020-01-01'],
      ['weightGrams', '1'],
    ] as const) {
      const response = await request(app.getHttpServer())
        .post('/holdings')
        .set('Cookie', cookie)
        .send({ ...validDeposit, management: `Extraneous-${field}`, [field]: value });
      expect(response.status).toBe(400);
      expect(response.body.fieldErrors).toContainEqual(expect.objectContaining({ field }));
    }
  });

  it('T018: submitting POST /holdings twice with the same (name, management) results in exactly one holding, valued at the second currentValue', async () => {
    const first = await request(app.getHttpServer())
      .post('/holdings')
      .set('Cookie', cookie)
      .send({ ...validDeposit, management: 'Upsert bank', name: 'Upsert checking' });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post('/holdings')
      .set('Cookie', cookie)
      .send({
        ...validDeposit,
        management: 'Upsert bank',
        name: 'Upsert checking',
        currentValue: '999.99',
      });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.currentValue).toBe('999.99');

    const list = await request(app.getHttpServer()).get('/holdings').set('Cookie', cookie);
    const matches = (list.body as { management: string; name: string }[]).filter(
      (holding) => holding.management === 'Upsert bank' && holding.name === 'Upsert checking',
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ currentValue: '999.99' } as never);
  });

  it('T019: two DEPOSIT_MONEY holdings with the same name but different management remain distinct after one is updated', async () => {
    const first = await request(app.getHttpServer())
      .post('/holdings')
      .set('Cookie', cookie)
      .send({ ...validDeposit, management: 'Bank One', name: 'Shared name' });
    const second = await request(app.getHttpServer())
      .post('/holdings')
      .set('Cookie', cookie)
      .send({ ...validDeposit, management: 'Bank Two', name: 'Shared name', currentValue: '50' });
    expect(first.body.id).not.toBe(second.body.id);

    await request(app.getHttpServer())
      .post('/holdings')
      .set('Cookie', cookie)
      .send({ ...validDeposit, management: 'Bank One', name: 'Shared name', currentValue: '777' });

    const list = await request(app.getHttpServer()).get('/holdings').set('Cookie', cookie);
    const bankTwo = (list.body as { id: string; currentValue: string }[]).find(
      (holding) => holding.id === second.body.id,
    );
    expect(bankTwo?.currentValue).toBe('50');
  });
});

/**
 * Backend authorization for domain entitlement (020-domain-library-architecture):
 * server-side `@RequiresDomain('holdings')`/`DomainGuard` must reject holdings
 * CRUD once an admin revokes a MEMBER's `holdings` domain scope — this was
 * previously enforced only client-side via the frontend's `domainGuard`.
 */
describe('/holdings — domain scope enforcement (020-domain-library-architecture)', () => {
  let app: INestApplication;
  let users: UsersRepository;
  let tempDir: string;
  let adminCookie: string;
  let memberCookie: string;
  let memberId: string;

  const ADMIN_EMAIL = 'admin-domain@example.com';
  const ADMIN_PASSWORD = 'a-valid-8-char-password';
  const MEMBER_EMAIL = 'member-domain@example.com';
  const MEMBER_PASSWORD = 'another-8-char-password';

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-holdings-domain-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    process.env.BOOTSTRAP_ADMIN_EMAIL = ADMIN_EMAIL;
    process.env.BOOTSTRAP_ADMIN_PASSWORD = ADMIN_PASSWORD;

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    users = moduleRef.get(UsersRepository);

    const adminSignIn = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    adminCookie = (adminSignIn.headers['set-cookie'] as unknown as string[])[0].split(';')[0];

    const argon2 = await import('argon2');
    const member = await users.create({
      email: MEMBER_EMAIL,
      displayName: 'Member Domain',
      passwordHash: await argon2.hash(MEMBER_PASSWORD),
      role: 'MEMBER',
    });
    memberId = member.id;

    const memberSignIn = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: MEMBER_EMAIL, password: MEMBER_PASSWORD });
    memberCookie = (memberSignIn.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
  });

  afterAll(async () => {
    await app.close();
    delete process.env.DATABASE_PATH;
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('a MEMBER can use /holdings by default (bootstrap domain scope includes holdings)', async () => {
    const response = await request(app.getHttpServer())
      .get('/holdings')
      .set('Cookie', memberCookie);
    expect(response.status).toBe(200);
  });

  it("revoking a MEMBER's holdings domain scope makes every /holdings route reject with 403, even though the record still exists", async () => {
    await request(app.getHttpServer())
      .patch(`/accounts/${memberId}/domain-scopes`)
      .set('Cookie', adminCookie)
      .send({ domainScopes: [] });

    const list = await request(app.getHttpServer()).get('/holdings').set('Cookie', memberCookie);
    expect(list.status).toBe(403);

    const create = await request(app.getHttpServer())
      .post('/holdings')
      .set('Cookie', memberCookie)
      .send({
        assetType: 'PRECIOUS_METAL',
        management: 'Home safe',
        name: 'Gold',
        weightGrams: '10',
      });
    expect(create.status).toBe(403);
  });

  it('an ADMIN can use /holdings regardless of domainScopes (FR-008 parity with the frontend)', async () => {
    const response = await request(app.getHttpServer()).get('/holdings').set('Cookie', adminCookie);
    expect(response.status).toBe(200);
  });
});
