import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../app/app.module';
import { UsersRepository } from '../auth/users.repository';
import { InvitationsRepository } from './invitations.repository';
import { EmailService } from './email.service';

/**
 * Integration tests for `/api/invitations/*` (contracts/invitations-api.md),
 * User Story 2. Real HTTP requests via `supertest` against a real temp-file
 * SQLite DB (Principle IV) — T033–T039. `EmailService` is overridden with a
 * jest mock so no real SMTP transport is ever exercised.
 */
describe('/invitations', () => {
  let app: INestApplication;
  let users: UsersRepository;
  let invitations: InvitationsRepository;
  let tempDir: string;
  let sendInvitation: jest.Mock;

  const ADMIN_EMAIL = 'admin@example.com';
  const ADMIN_PASSWORD = 'a-valid-8-char-password';

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-invitations-e2e-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    process.env.BOOTSTRAP_ADMIN_EMAIL = ADMIN_EMAIL;
    process.env.BOOTSTRAP_ADMIN_PASSWORD = ADMIN_PASSWORD;
    process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES = '30';
    process.env.SESSION_ABSOLUTE_LIFETIME_HOURS = '12';
    process.env.ACCOUNT_RETENTION_DAYS = '30';
    process.env.INVITATION_EXPIRY_DAYS = '7';

    sendInvitation = jest.fn().mockResolvedValue(undefined);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue({ sendInvitation })
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    users = moduleRef.get(UsersRepository);
    invitations = moduleRef.get(InvitationsRepository);
  });

  afterAll(async () => {
    await app.close();
    delete process.env.DATABASE_PATH;
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    delete process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES;
    delete process.env.SESSION_ABSOLUTE_LIFETIME_HOURS;
    delete process.env.ACCOUNT_RETENTION_DAYS;
    delete process.env.INVITATION_EXPIRY_DAYS;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    sendInvitation.mockClear();
    sendInvitation.mockResolvedValue(undefined);
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

  let cachedAdminCookie: string | undefined;

  /** Memoized — the sign-in route is rate-limited (20/60s) and this file signs in far more than 20 times if not cached. */
  async function adminCookie(): Promise<string> {
    if (!cachedAdminCookie) {
      cachedAdminCookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
    }
    return cachedAdminCookie;
  }

  describe('POST /invitations', () => {
    it('creates and emails an invitation: 201', async () => {
      const cookie = await adminCookie();

      const response = await request(app.getHttpServer())
        .post('/invitations')
        .set('Cookie', cookie)
        .send({ email: 'invitee@example.com', role: 'MEMBER' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        email: 'invitee@example.com',
        role: 'MEMBER',
        status: 'PENDING',
      });
      expect(sendInvitation).toHaveBeenCalledTimes(1);
      expect(sendInvitation.mock.calls[0][0]).toBe('invitee@example.com');
    });

    it('returns 409 account_exists for an email with an active account', async () => {
      const cookie = await adminCookie();

      const response = await request(app.getHttpServer())
        .post('/invitations')
        .set('Cookie', cookie)
        .send({ email: ADMIN_EMAIL, role: 'MEMBER' });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: 'account_exists',
        message: 'This email already has an account.',
      });
    });

    it('returns 409 account_exists for an email with an archived account', async () => {
      const cookie = await adminCookie();
      const hash = await import('argon2').then((argon2) => argon2.hash(ADMIN_PASSWORD));
      const archivedUser = await users.create({
        email: 'archived-user@example.com',
        displayName: 'Archived User',
        passwordHash: hash,
        role: 'MEMBER',
      });
      await users.archive(archivedUser.id, new Date(Date.now() + 60_000).toISOString());

      const response = await request(app.getHttpServer())
        .post('/invitations')
        .set('Cookie', cookie)
        .send({ email: 'archived-user@example.com', role: 'MEMBER' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('account_exists');
    });

    it('returns 502 email_delivery_failed but still creates the row', async () => {
      sendInvitation.mockRejectedValueOnce(new Error('SMTP connection refused'));
      const cookie = await adminCookie();

      const response = await request(app.getHttpServer())
        .post('/invitations')
        .set('Cookie', cookie)
        .send({ email: 'delivery-fail@example.com', role: 'MEMBER' });

      expect(response.status).toBe(502);
      expect(response.body).toEqual({
        error: 'email_delivery_failed',
        message: 'Invitation saved, but the email could not be sent. Try resending.',
      });

      const pending = await invitations.findPendingByEmail('delivery-fail@example.com');
      expect(pending).not.toBeNull();
    });
  });

  describe('supersede on re-invite', () => {
    it('inviting the same email again supersedes the first: old token 410s on lookup', async () => {
      const cookie = await adminCookie();

      const first = await request(app.getHttpServer())
        .post('/invitations')
        .set('Cookie', cookie)
        .send({ email: 'supersede-e2e@example.com', role: 'MEMBER' });
      const firstToken = sendInvitation.mock.calls[0][1] as string;

      const second = await request(app.getHttpServer())
        .post('/invitations')
        .set('Cookie', cookie)
        .send({ email: 'supersede-e2e@example.com', role: 'ADMIN' });

      expect(second.status).toBe(201);
      expect(second.body.id).not.toBe(first.body.id);

      const oldLookup = await request(app.getHttpServer()).get(`/invitations/token/${firstToken}`);
      expect(oldLookup.status).toBe(410);
      expect(oldLookup.body).toEqual({
        error: 'invalid_invitation',
        message: 'This invitation link is no longer valid.',
      });
    });
  });

  describe('GET /invitations', () => {
    it('lists invitations with status and createdAt', async () => {
      const cookie = await adminCookie();
      await request(app.getHttpServer())
        .post('/invitations')
        .set('Cookie', cookie)
        .send({ email: 'list-me@example.com', role: 'MEMBER' });

      const response = await request(app.getHttpServer()).get('/invitations').set('Cookie', cookie);

      expect(response.status).toBe(200);
      const row = (
        response.body as Array<{ email: string; status: string; createdAt: string }>
      ).find((r) => r.email === 'list-me@example.com');
      expect(row?.status).toBe('PENDING');
      expect(row?.createdAt).toBeTruthy();
    });
  });

  describe('POST /invitations/:id/cancel', () => {
    it('cancels a pending invitation: 200 CANCELLED', async () => {
      const cookie = await adminCookie();
      const created = await request(app.getHttpServer())
        .post('/invitations')
        .set('Cookie', cookie)
        .send({ email: 'cancel-me@example.com', role: 'MEMBER' });

      const response = await request(app.getHttpServer())
        .post(`/invitations/${created.body.id}/cancel`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('CANCELLED');
    });

    it('returns 404 for an unknown id', async () => {
      const cookie = await adminCookie();
      const response = await request(app.getHttpServer())
        .post('/invitations/nonexistent-id/cancel')
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'not_found', message: 'Invitation not found.' });
    });

    it('returns 409 already_resolved when cancelling a non-pending invitation', async () => {
      const cookie = await adminCookie();
      const created = await request(app.getHttpServer())
        .post('/invitations')
        .set('Cookie', cookie)
        .send({ email: 'cancel-twice@example.com', role: 'MEMBER' });
      await request(app.getHttpServer())
        .post(`/invitations/${created.body.id}/cancel`)
        .set('Cookie', cookie);

      const response = await request(app.getHttpServer())
        .post(`/invitations/${created.body.id}/cancel`)
        .set('Cookie', cookie);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: 'already_resolved',
        message: 'This invitation was already accepted, cancelled, or superseded.',
      });
    });
  });

  describe('POST /invitations/:id/resend', () => {
    it('resends: 201 new row, old superseded, re-emailed', async () => {
      const cookie = await adminCookie();
      const created = await request(app.getHttpServer())
        .post('/invitations')
        .set('Cookie', cookie)
        .send({ email: 'resend-me@example.com', role: 'MEMBER' });
      sendInvitation.mockClear();

      const response = await request(app.getHttpServer())
        .post(`/invitations/${created.body.id}/resend`)
        .set('Cookie', cookie);

      expect(response.status).toBe(201);
      expect(response.body.id).not.toBe(created.body.id);
      expect(response.body.email).toBe('resend-me@example.com');
      expect(sendInvitation).toHaveBeenCalledTimes(1);

      const oldRow = await invitations.findById(created.body.id);
      expect(oldRow?.status).toBe('SUPERSEDED');
    });

    it('returns 404 for an unknown id', async () => {
      const cookie = await adminCookie();
      const response = await request(app.getHttpServer())
        .post('/invitations/nonexistent-id/resend')
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });

    it('returns 409 already_resolved when resending a non-pending invitation', async () => {
      const cookie = await adminCookie();
      const created = await request(app.getHttpServer())
        .post('/invitations')
        .set('Cookie', cookie)
        .send({ email: 'resend-cancelled@example.com', role: 'MEMBER' });
      await request(app.getHttpServer())
        .post(`/invitations/${created.body.id}/cancel`)
        .set('Cookie', cookie);

      const response = await request(app.getHttpServer())
        .post(`/invitations/${created.body.id}/resend`)
        .set('Cookie', cookie);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('already_resolved');
    });

    it('returns 502 email_delivery_failed but still creates the new row', async () => {
      const cookie = await adminCookie();
      const created = await request(app.getHttpServer())
        .post('/invitations')
        .set('Cookie', cookie)
        .send({ email: 'resend-fail@example.com', role: 'MEMBER' });
      sendInvitation.mockRejectedValueOnce(new Error('SMTP down'));

      const response = await request(app.getHttpServer())
        .post(`/invitations/${created.body.id}/resend`)
        .set('Cookie', cookie);

      expect(response.status).toBe(502);
      expect(response.body).toEqual({
        error: 'email_delivery_failed',
        message: 'Invitation saved, but the email could not be sent. Try resending.',
      });
    });
  });

  describe('GET /invitations/token/:token (public)', () => {
    it('returns email/role for a pending, unexpired token: 200', async () => {
      const cookie = await adminCookie();
      await request(app.getHttpServer())
        .post('/invitations')
        .set('Cookie', cookie)
        .send({ email: 'lookup-me@example.com', role: 'ADMIN' });
      const token = sendInvitation.mock.calls[0][1] as string;

      const response = await request(app.getHttpServer()).get(`/invitations/token/${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ email: 'lookup-me@example.com', role: 'ADMIN' });
    });

    it('returns 410 invalid_invitation for an unknown token', async () => {
      const response = await request(app.getHttpServer()).get('/invitations/token/unknown-token');

      expect(response.status).toBe(410);
      expect(response.body).toEqual({
        error: 'invalid_invitation',
        message: 'This invitation link is no longer valid.',
      });
    });

    it('returns 410 invalid_invitation for an expired token', async () => {
      // No public API mutates expires_at — create a row with a past expiry
      // directly via the repository to simulate the passage of time.
      const admin = await users.findByEmail(ADMIN_EMAIL);
      expect(admin).not.toBeNull();
      const expiredToken = 'expired-token-directly-created';
      await invitations.create({
        email: 'already-expired@example.com',
        token: expiredToken,
        role: 'MEMBER',
        invitedBy: (admin as NonNullable<typeof admin>).id,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });

      const response = await request(app.getHttpServer()).get(`/invitations/token/${expiredToken}`);

      expect(response.status).toBe(410);
    });
  });

  describe('POST /invitations/token/:token/accept (public)', () => {
    it('accepts: 201, creates the user, signs in, subsequent sign-in works', async () => {
      const cookie = await adminCookie();
      await request(app.getHttpServer())
        .post('/invitations')
        .set('Cookie', cookie)
        .send({ email: 'accept-me@example.com', role: 'MEMBER' });
      const token = sendInvitation.mock.calls[sendInvitation.mock.calls.length - 1][1] as string;

      const response = await request(app.getHttpServer())
        .post(`/invitations/token/${token}/accept`)
        .send({ password: 'a-fresh-8-char-pw', displayName: 'Accepted User' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        email: 'accept-me@example.com',
        displayName: 'Accepted User',
        role: 'MEMBER',
      });
      expect(response.headers['set-cookie']).toBeDefined();

      const signInResponse = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email: 'accept-me@example.com', password: 'a-fresh-8-char-pw' });
      expect(signInResponse.status).toBe(200);
    });

    it('returns 400 invalid_password when the password fails policy', async () => {
      const cookie = await adminCookie();
      await request(app.getHttpServer())
        .post('/invitations')
        .set('Cookie', cookie)
        .send({ email: 'bad-password@example.com', role: 'MEMBER' });
      const token = sendInvitation.mock.calls[sendInvitation.mock.calls.length - 1][1] as string;

      const response = await request(app.getHttpServer())
        .post(`/invitations/token/${token}/accept`)
        .send({ password: 'short', displayName: 'Someone' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_password');
    });

    it('returns 410 on replay after a successful accept — no duplicate account created', async () => {
      const cookie = await adminCookie();
      await request(app.getHttpServer())
        .post('/invitations')
        .set('Cookie', cookie)
        .send({ email: 'replay-me@example.com', role: 'MEMBER' });
      const token = sendInvitation.mock.calls[sendInvitation.mock.calls.length - 1][1] as string;

      await request(app.getHttpServer())
        .post(`/invitations/token/${token}/accept`)
        .send({ password: 'a-fresh-8-char-pw', displayName: 'Replay User' });

      const replay = await request(app.getHttpServer())
        .post(`/invitations/token/${token}/accept`)
        .send({ password: 'another-8-char-pw', displayName: 'Replay User 2' });

      expect(replay.status).toBe(410);
      expect(replay.body).toEqual({
        error: 'invalid_invitation',
        message: 'This invitation link is no longer valid.',
      });

      const usersWithEmail = await users.findByEmail('replay-me@example.com');
      expect(usersWithEmail).not.toBeNull(); // exactly one — the first accept's
    });

    it('returns 410 for an expired token at accept time', async () => {
      const adminUser = await users.findByEmail(ADMIN_EMAIL);
      expect(adminUser).not.toBeNull();
      const expiredToken = 'expired-token-for-accept';
      await invitations.create({
        email: 'expired-accept@example.com',
        token: expiredToken,
        role: 'MEMBER',
        invitedBy: (adminUser as NonNullable<typeof adminUser>).id,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });

      const response = await request(app.getHttpServer())
        .post(`/invitations/token/${expiredToken}/accept`)
        .send({ password: 'a-fresh-8-char-pw', displayName: 'Should Not Work' });

      expect(response.status).toBe(410);
    });

    it('returns 410 for a cancelled token at accept time', async () => {
      const cookie = await adminCookie();
      const created = await request(app.getHttpServer())
        .post('/invitations')
        .set('Cookie', cookie)
        .send({ email: 'cancel-then-accept@example.com', role: 'MEMBER' });
      const token = sendInvitation.mock.calls[sendInvitation.mock.calls.length - 1][1] as string;
      await request(app.getHttpServer())
        .post(`/invitations/${created.body.id}/cancel`)
        .set('Cookie', cookie);

      const response = await request(app.getHttpServer())
        .post(`/invitations/token/${token}/accept`)
        .send({ password: 'a-fresh-8-char-pw', displayName: 'Should Not Work' });

      expect(response.status).toBe(410);
    });
  });

  describe('non-admin access', () => {
    it('returns 403 for a MEMBER on admin-only invitations routes', async () => {
      const hash = await import('argon2').then((argon2) => argon2.hash(ADMIN_PASSWORD));
      await users.create({
        email: 'plain-member-invites@example.com',
        displayName: 'Plain Member',
        passwordHash: hash,
        role: 'MEMBER',
      });
      const cookie = await signIn('plain-member-invites@example.com', ADMIN_PASSWORD);

      const agent = request(app.getHttpServer());
      const responses = [
        await agent
          .post('/invitations')
          .set('Cookie', cookie)
          .send({ email: 'x@example.com', role: 'MEMBER' }),
        await agent.get('/invitations').set('Cookie', cookie),
        await agent.post('/invitations/some-id/cancel').set('Cookie', cookie),
        await agent.post('/invitations/some-id/resend').set('Cookie', cookie),
      ];

      for (const response of responses) {
        expect(response.status).toBe(403);
      }
    });
  });
});
