import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../app/app.module';
import { UsersRepository } from '../auth/users.repository';

/**
 * Integration tests for `/api/accounts/*` (contracts/accounts-api.md), User
 * Story 1. Real HTTP requests via `supertest` against a real temp-file
 * SQLite DB, per Principle IV — T018–T023.
 */
describe('/accounts', () => {
  let app: INestApplication;
  let users: UsersRepository;
  let tempDir: string;

  const ADMIN_EMAIL = 'admin@example.com';
  const ADMIN_PASSWORD = 'a-valid-8-char-password';

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-accounts-e2e-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    process.env.BOOTSTRAP_ADMIN_EMAIL = ADMIN_EMAIL;
    process.env.BOOTSTRAP_ADMIN_PASSWORD = ADMIN_PASSWORD;
    process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES = '30';
    process.env.SESSION_ABSOLUTE_LIFETIME_HOURS = '12';
    process.env.ACCOUNT_RETENTION_DAYS = '30';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    users = moduleRef.get(UsersRepository);
  });

  afterAll(async () => {
    await app.close();
    delete process.env.DATABASE_PATH;
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    delete process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES;
    delete process.env.SESSION_ABSOLUTE_LIFETIME_HOURS;
    delete process.env.ACCOUNT_RETENTION_DAYS;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function extractCookie(response: request.Response): string {
    const setCookie = response.headers['set-cookie'] as unknown as string[];
    const sessionCookie = setCookie.find((c) => c.startsWith('vaultfolio_session='));
    if (!sessionCookie) {
      throw new Error('No session cookie set');
    }
    return sessionCookie.split(';')[0];
  }

  async function signIn(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email, password });
    return extractCookie(response);
  }

  async function createMember(email: string, role: 'ADMIN' | 'MEMBER' = 'MEMBER') {
    const hash = await import('argon2').then((argon2) => argon2.hash('a-valid-8-char-password'));
    return users.create({ email, displayName: email, passwordHash: hash, role });
  }

  describe('GET /accounts', () => {
    it('returns every account, active and archived, with isLastActiveAdmin correct', async () => {
      const cookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      const member = await createMember('list-member@example.com');

      const response = await request(app.getHttpServer()).get('/accounts').set('Cookie', cookie);

      expect(response.status).toBe(200);
      const bodyList = response.body as Array<{
        id: string;
        email: string;
        isLastActiveAdmin: boolean;
      }>;
      const adminSummary = bodyList.find((a) => a.email === ADMIN_EMAIL);
      const memberSummary = bodyList.find((a) => a.id === member.id);

      expect(adminSummary?.isLastActiveAdmin).toBe(true);
      expect(memberSummary?.isLastActiveAdmin).toBe(false);
    });
  });

  describe('PATCH /accounts/:id/role', () => {
    it('changes a member role to ADMIN: 200', async () => {
      const cookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      const member = await createMember('role-change@example.com');

      const response = await request(app.getHttpServer())
        .patch(`/accounts/${member.id}/role`)
        .set('Cookie', cookie)
        .send({ role: 'ADMIN' });

      expect(response.status).toBe(200);
      expect(response.body.role).toBe('ADMIN');

      // Revert so ADMIN_EMAIL stays the sole active admin for later tests
      // (this file shares one app/db instance across all cases).
      await request(app.getHttpServer())
        .patch(`/accounts/${member.id}/role`)
        .set('Cookie', cookie)
        .send({ role: 'MEMBER' });
    });

    it('returns 404 for a nonexistent account', async () => {
      const cookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);

      const response = await request(app.getHttpServer())
        .patch('/accounts/nonexistent-id/role')
        .set('Cookie', cookie)
        .send({ role: 'MEMBER' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'not_found', message: 'Account not found.' });
    });

    it('returns 403 forbidden when an admin attempts to change their own role', async () => {
      const cookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      const admin = await users.findByEmail(ADMIN_EMAIL);

      const response = await request(app.getHttpServer())
        .patch(`/accounts/${admin?.id}/role`)
        .set('Cookie', cookie)
        .send({ role: 'MEMBER' });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'forbidden',
        message: 'You do not have access to this resource.',
      });
    });

    // Note: the last_admin invariant in AccountsService#changeRole is now
    // unreachable via this endpoint — reaching it requires actor !== target
    // while target is the sole active admin, but only an active admin may
    // call this route at all, so a distinct actor implies activeAdminCount
    // >= 2 (no longer "sole"). The branch stays as defense-in-depth (e.g. if
    // the self-change check above were ever relaxed); `canRemoveLastAdmin`
    // itself is covered directly in last-admin.spec.ts.
  });

  describe('POST /accounts/:id/archive', () => {
    it('archives an account: 200, and invalidates its sessions (401 on next request)', async () => {
      const adminCookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      const member = await createMember('archive-me@example.com');
      const memberCookie = await signIn('archive-me@example.com', 'a-valid-8-char-password');

      const archiveResponse = await request(app.getHttpServer())
        .post(`/accounts/${member.id}/archive`)
        .set('Cookie', adminCookie);

      expect(archiveResponse.status).toBe(200);
      expect(archiveResponse.body.status).toBe('ARCHIVED');
      expect(archiveResponse.body.retentionExpiresAt).not.toBeNull();

      const replay = await request(app.getHttpServer())
        .get('/auth/session')
        .set('Cookie', memberCookie);
      expect(replay.status).toBe(401);
    });

    it('returns 409 already_archived on a second archive', async () => {
      const adminCookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      const member = await createMember('archive-twice@example.com');

      await request(app.getHttpServer())
        .post(`/accounts/${member.id}/archive`)
        .set('Cookie', adminCookie);
      const second = await request(app.getHttpServer())
        .post(`/accounts/${member.id}/archive`)
        .set('Cookie', adminCookie);

      expect(second.status).toBe(409);
      expect(second.body).toEqual({
        error: 'already_archived',
        message: 'This account was already archived.',
      });
    });

    it('returns 409 last_admin when archiving the sole active admin', async () => {
      const adminCookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      const admin = await users.findByEmail(ADMIN_EMAIL);

      const response = await request(app.getHttpServer())
        .post(`/accounts/${admin?.id}/archive`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: 'last_admin',
        message: 'At least one active administrator must remain.',
      });
    });
  });

  describe('POST /accounts/:id/reactivate', () => {
    it('reactivates an archived account within retention: 200', async () => {
      const adminCookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      const member = await createMember('reactivate-me@example.com');
      await request(app.getHttpServer())
        .post(`/accounts/${member.id}/archive`)
        .set('Cookie', adminCookie);

      const response = await request(app.getHttpServer())
        .post(`/accounts/${member.id}/reactivate`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ACTIVE');
      expect(response.body.archivedAt).toBeNull();
    });

    it('returns 410 retention_expired past the retention window', async () => {
      const adminCookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      const member = await createMember('reactivate-expired@example.com');
      await users.archive(member.id, new Date(Date.now() - 1000).toISOString());

      const response = await request(app.getHttpServer())
        .post(`/accounts/${member.id}/reactivate`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(410);
      expect(response.body).toEqual({
        error: 'retention_expired',
        message: "This account's retention window has passed.",
      });
    });
  });

  describe('DELETE /accounts/:id', () => {
    it('self-deletes: 204, sessions invalidated', async () => {
      await createMember('self-admin@example.com', 'ADMIN');
      const cookie = await signIn('self-admin@example.com', 'a-valid-8-char-password');
      const self = await users.findByEmail('self-admin@example.com');

      const response = await request(app.getHttpServer())
        .delete(`/accounts/${self?.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(204);

      const replay = await request(app.getHttpServer()).get('/auth/session').set('Cookie', cookie);
      expect(replay.status).toBe(401);
    });

    it('returns 403 forbidden when deleting another account', async () => {
      const cookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      const other = await createMember('not-self@example.com');

      const response = await request(app.getHttpServer())
        .delete(`/accounts/${other.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'forbidden',
        message: 'You do not have access to this resource.',
      });
    });

    it('returns 409 last_admin when the sole active admin self-deletes', async () => {
      const cookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      const admin = await users.findByEmail(ADMIN_EMAIL);

      const response = await request(app.getHttpServer())
        .delete(`/accounts/${admin?.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: 'last_admin',
        message: 'At least one active administrator must remain.',
      });
    });
  });

  describe('PATCH /accounts/:id/domain-scopes', () => {
    it('persists valid domain ids and returns them on the updated account: 200', async () => {
      const cookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      const member = await createMember('domain-scopes-valid@example.com');

      const response = await request(app.getHttpServer())
        .patch(`/accounts/${member.id}/domain-scopes`)
        .set('Cookie', cookie)
        .send({ domainScopes: ['holdings'] });

      expect(response.status).toBe(200);
      expect(response.body.domainScopes).toEqual(['holdings']);
    });

    it('rejects an unknown domain id: 400 invalid_domain, leaving the account unchanged', async () => {
      const cookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      const member = await createMember('domain-scopes-invalid@example.com');

      const response = await request(app.getHttpServer())
        .patch(`/accounts/${member.id}/domain-scopes`)
        .set('Cookie', cookie)
        .send({ domainScopes: ['not-a-real-domain'] });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'invalid_domain',
        message: 'One or more domain ids are not recognized.',
      });

      const unchanged = await users.findById(member.id);
      expect(unchanged?.domainScopes).toEqual(['holdings']);
    });

    it('returns 404 for a nonexistent account', async () => {
      const cookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);

      const response = await request(app.getHttpServer())
        .patch('/accounts/nonexistent-id/domain-scopes')
        .set('Cookie', cookie)
        .send({ domainScopes: ['holdings'] });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'not_found', message: 'Account not found.' });
    });
  });

  describe('non-admin access', () => {
    it('returns 403 for a MEMBER on every /accounts route', async () => {
      await createMember('plain-member@example.com');
      const cookie = await signIn('plain-member@example.com', 'a-valid-8-char-password');
      const adminId = (await users.findByEmail(ADMIN_EMAIL))?.id;

      const agent = request(app.getHttpServer());
      const responses = [
        await agent.get('/accounts').set('Cookie', cookie),
        await agent
          .patch(`/accounts/${adminId}/role`)
          .set('Cookie', cookie)
          .send({ role: 'MEMBER' }),
        await agent.post(`/accounts/${adminId}/archive`).set('Cookie', cookie),
        await agent.post(`/accounts/${adminId}/reactivate`).set('Cookie', cookie),
        await agent.delete(`/accounts/${adminId}`).set('Cookie', cookie),
      ];

      for (const response of responses) {
        expect(response.status).toBe(403);
      }
    });
  });
});
