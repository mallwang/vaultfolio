import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../app/app.module';
import { UsersRepository } from '../auth/users.repository';
import { SignupsRepository } from './signups.repository';
import { EmailService } from './email.service';

/**
 * Integration tests for `/api/signups/*` (contracts/signups-api.md), User
 * Stories 1 & 2. Real HTTP requests via `supertest` against a real temp-file
 * SQLite DB (Principle IV), mirroring `invitations.controller.spec.ts`.
 * `EmailService` is overridden with a jest mock so no real SMTP transport is
 * ever exercised.
 */
describe('/signups', () => {
  let app: INestApplication;
  let users: UsersRepository;
  let signups: SignupsRepository;
  let tempDir: string;
  let sendVerification: jest.Mock;
  let sendAdminNotification: jest.Mock;
  let sendWelcome: jest.Mock;
  let sendRejection: jest.Mock;

  const ADMIN_EMAIL = 'admin@example.com';
  const ADMIN_PASSWORD = 'a-valid-8-char-password';

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-signups-e2e-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    process.env.BOOTSTRAP_ADMIN_EMAIL = ADMIN_EMAIL;
    process.env.BOOTSTRAP_ADMIN_PASSWORD = ADMIN_PASSWORD;
    process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES = '30';
    process.env.SESSION_ABSOLUTE_LIFETIME_HOURS = '12';
    process.env.ACCOUNT_RETENTION_DAYS = '30';
    process.env.INVITATION_EXPIRY_DAYS = '7';
    process.env.SIGNUP_EXPIRY_HOURS = '24';
    process.env.PUBLIC_SIGNUP_ENABLED = 'true';

    sendVerification = jest.fn().mockResolvedValue(undefined);
    sendAdminNotification = jest.fn().mockResolvedValue(undefined);
    sendWelcome = jest.fn().mockResolvedValue(undefined);
    sendRejection = jest.fn().mockResolvedValue(undefined);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue({ sendVerification, sendAdminNotification, sendWelcome, sendRejection })
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    users = moduleRef.get(UsersRepository);
    signups = moduleRef.get(SignupsRepository);
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
    delete process.env.SIGNUP_EXPIRY_HOURS;
    delete process.env.PUBLIC_SIGNUP_ENABLED;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    sendVerification.mockClear().mockResolvedValue(undefined);
    sendAdminNotification.mockClear().mockResolvedValue(undefined);
    sendWelcome.mockClear().mockResolvedValue(undefined);
    sendRejection.mockClear().mockResolvedValue(undefined);
    process.env.PUBLIC_SIGNUP_ENABLED = 'true';
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

  /** Memoized — the sign-in route is rate-limited (20/60s). */
  async function adminCookie(): Promise<string> {
    if (!cachedAdminCookie) {
      cachedAdminCookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
    }
    return cachedAdminCookie;
  }

  /** Full submit -> verify flow, returning the resulting id and email. */
  async function submitAndVerify(email: string): Promise<{ id: string; email: string }> {
    await request(app.getHttpServer())
      .post('/signups')
      .send({ email, password: 'a-valid-8-char-password' });
    const token = sendVerification.mock.calls[sendVerification.mock.calls.length - 1][1] as string;
    await request(app.getHttpServer()).post(`/signups/token/${token}/verify`);
    const cookie = await adminCookie();
    const list = await request(app.getHttpServer()).get('/signups').set('Cookie', cookie);
    const row = (list.body as Array<{ id: string; email: string }>).find((r) => r.email === email);
    if (!row) {
      throw new Error(`signup row not found for ${email}`);
    }
    return { id: row.id, email: row.email };
  }

  describe('POST /signups', () => {
    it('creates a request and sends the verification email: 201', async () => {
      const response = await request(app.getHttpServer())
        .post('/signups')
        .send({ email: 'submit-me@example.com', password: 'a-valid-8-char-password' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ email: 'submit-me@example.com' });
      expect(sendVerification).toHaveBeenCalledTimes(1);
      expect(sendVerification.mock.calls[0][0]).toBe('submit-me@example.com');
    });

    it('returns 400 invalid_password for a too-short password', async () => {
      const response = await request(app.getHttpServer())
        .post('/signups')
        .send({ email: 'bad-password@example.com', password: 'short' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_password');
    });

    it('returns 409 email_unavailable for an email with an active account', async () => {
      const response = await request(app.getHttpServer())
        .post('/signups')
        .send({ email: ADMIN_EMAIL, password: 'a-valid-8-char-password' });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: 'email_unavailable',
        message: "This email can't be used to sign up right now.",
      });
    });

    it('returns 409 email_unavailable when the same email is submitted twice', async () => {
      await request(app.getHttpServer())
        .post('/signups')
        .send({ email: 'duplicate-signup@example.com', password: 'a-valid-8-char-password' });

      const response = await request(app.getHttpServer())
        .post('/signups')
        .send({ email: 'duplicate-signup@example.com', password: 'a-valid-8-char-password' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('email_unavailable');
    });

    it('returns 502 email_delivery_failed but still creates the row', async () => {
      sendVerification.mockRejectedValueOnce(new Error('SMTP connection refused'));

      const response = await request(app.getHttpServer())
        .post('/signups')
        .send({ email: 'delivery-fail@example.com', password: 'a-valid-8-char-password' });

      expect(response.status).toBe(502);
      expect(response.body).toEqual({
        error: 'email_delivery_failed',
        message: 'Sign-up saved, but the verification email could not be sent.',
      });

      const pending = await signups.findActiveByEmail('delivery-fail@example.com');
      expect(pending).not.toBeNull();
    });

    it('returns 403 signup_disabled when PUBLIC_SIGNUP_ENABLED=false', async () => {
      process.env.PUBLIC_SIGNUP_ENABLED = 'false';

      const response = await request(app.getHttpServer())
        .post('/signups')
        .send({ email: 'toggle-off@example.com', password: 'a-valid-8-char-password' });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'signup_disabled',
        message: 'Public sign-up is not available.',
      });
    });
  });

  describe('GET /signups/token/:token (public)', () => {
    it('returns email for a pending, unexpired token: 200', async () => {
      await request(app.getHttpServer())
        .post('/signups')
        .send({ email: 'lookup-me@example.com', password: 'a-valid-8-char-password' });
      const token = sendVerification.mock.calls[0][1] as string;

      const response = await request(app.getHttpServer()).get(`/signups/token/${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ email: 'lookup-me@example.com' });
    });

    it('returns 410 invalid_token for an unknown token', async () => {
      const response = await request(app.getHttpServer()).get('/signups/token/unknown-token');

      expect(response.status).toBe(410);
      expect(response.body).toEqual({
        error: 'invalid_token',
        message: 'This verification link is no longer valid.',
      });
    });
  });

  describe('POST /signups/token/:token/verify (public)', () => {
    it('verifies and notifies admins: 200', async () => {
      await request(app.getHttpServer())
        .post('/signups')
        .send({ email: 'verify-me@example.com', password: 'a-valid-8-char-password' });
      const token = sendVerification.mock.calls[0][1] as string;

      const response = await request(app.getHttpServer()).post(`/signups/token/${token}/verify`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ email: 'verify-me@example.com', status: 'VERIFIED' });
      expect(sendAdminNotification).toHaveBeenCalledTimes(1);
      expect(sendAdminNotification.mock.calls[0][0]).toContain(ADMIN_EMAIL);
    });

    it('returns 410 invalid_token on a second verify attempt (replay)', async () => {
      await request(app.getHttpServer())
        .post('/signups')
        .send({ email: 'replay-verify@example.com', password: 'a-valid-8-char-password' });
      const token = sendVerification.mock.calls[0][1] as string;
      await request(app.getHttpServer()).post(`/signups/token/${token}/verify`);

      const response = await request(app.getHttpServer()).post(`/signups/token/${token}/verify`);

      expect(response.status).toBe(410);
      expect(response.body.error).toBe('invalid_token');
    });
  });

  describe('GET /signups (admin)', () => {
    it('lists sign-up requests with status and createdAt', async () => {
      await request(app.getHttpServer())
        .post('/signups')
        .send({ email: 'list-me@example.com', password: 'a-valid-8-char-password' });
      const cookie = await adminCookie();

      const response = await request(app.getHttpServer()).get('/signups').set('Cookie', cookie);

      expect(response.status).toBe(200);
      const row = (
        response.body as Array<{ email: string; status: string; createdAt: string }>
      ).find((r) => r.email === 'list-me@example.com');
      expect(row?.status).toBe('PENDING');
      expect(row?.createdAt).toBeTruthy();
    });
  });

  describe('POST /signups/:id/approve (admin)', () => {
    it('approves a verified request: 200 APPROVED, creates the account, sends welcome email', async () => {
      const { id, email } = await submitAndVerify('approve-me@example.com');
      const cookie = await adminCookie();

      const response = await request(app.getHttpServer())
        .post(`/signups/${id}/approve`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('APPROVED');
      expect(sendWelcome).toHaveBeenCalledWith(email);

      const signInResponse = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email, password: 'a-valid-8-char-password' });
      expect(signInResponse.status).toBe(200);
    });

    it('returns 400 not_verified for a still-PENDING request', async () => {
      const submitResponse = await request(app.getHttpServer())
        .post('/signups')
        .send({ email: 'unverified@example.com', password: 'a-valid-8-char-password' });
      expect(submitResponse.status).toBe(201);
      const cookie = await adminCookie();
      const list = await request(app.getHttpServer()).get('/signups').set('Cookie', cookie);
      const row = (list.body as Array<{ id: string; email: string }>).find(
        (r) => r.email === 'unverified@example.com',
      );

      const response = await request(app.getHttpServer())
        .post(`/signups/${row?.id}/approve`)
        .set('Cookie', cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('not_verified');
    });

    it('returns 404 for an unknown id', async () => {
      const cookie = await adminCookie();
      const response = await request(app.getHttpServer())
        .post('/signups/nonexistent-id/approve')
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'not_found', message: 'Sign-up request not found.' });
    });

    it('returns 409 already_resolved on a second approve (race)', async () => {
      const { id } = await submitAndVerify('approve-twice@example.com');
      const cookie = await adminCookie();
      await request(app.getHttpServer()).post(`/signups/${id}/approve`).set('Cookie', cookie);

      const response = await request(app.getHttpServer())
        .post(`/signups/${id}/approve`)
        .set('Cookie', cookie);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('already_resolved');
    });
  });

  describe('POST /signups/:id/reject (admin)', () => {
    it('rejects a verified request: 200 REJECTED, blacklists the email, no reason leaked to visitor', async () => {
      const { id, email } = await submitAndVerify('reject-me@example.com');
      const cookie = await adminCookie();

      const response = await request(app.getHttpServer())
        .post(`/signups/${id}/reject`)
        .set('Cookie', cookie)
        .send({ reason: 'looked like spam' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REJECTED');
      expect(sendRejection).toHaveBeenCalledWith(email);

      const again = await request(app.getHttpServer())
        .post('/signups')
        .send({ email, password: 'a-valid-8-char-password' });
      expect(again.status).toBe(409);
      expect(again.body.error).toBe('email_unavailable');
    });
  });

  describe('DELETE /signups/:id (admin)', () => {
    it('deletes a rejected entry and clears the blacklist, freeing the email', async () => {
      const { id, email } = await submitAndVerify('delete-rejected@example.com');
      const cookie = await adminCookie();
      await request(app.getHttpServer())
        .post(`/signups/${id}/reject`)
        .set('Cookie', cookie)
        .send({});

      const deleteResponse = await request(app.getHttpServer())
        .delete(`/signups/${id}`)
        .set('Cookie', cookie);
      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body).toEqual({ deleted: true });

      const resubmit = await request(app.getHttpServer())
        .post('/signups')
        .send({ email, password: 'a-valid-8-char-password' });
      expect(resubmit.status).toBe(201);
    });

    it('returns 404 for an unknown id', async () => {
      const cookie = await adminCookie();
      const response = await request(app.getHttpServer())
        .delete('/signups/nonexistent-id')
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });
  });

  describe('non-admin access', () => {
    it('returns 403 for a MEMBER on admin-only signups routes', async () => {
      const hash = await import('argon2').then((argon2) => argon2.hash(ADMIN_PASSWORD));
      await users.create({
        email: 'plain-member-signups@example.com',
        displayName: 'Plain Member',
        passwordHash: hash,
        role: 'MEMBER',
      });
      const cookie = await signIn('plain-member-signups@example.com', ADMIN_PASSWORD);

      const agent = request(app.getHttpServer());
      const responses = [
        await agent.get('/signups').set('Cookie', cookie),
        await agent.post('/signups/some-id/approve').set('Cookie', cookie),
        await agent.post('/signups/some-id/reject').set('Cookie', cookie),
        await agent.delete('/signups/some-id').set('Cookie', cookie),
      ];

      for (const response of responses) {
        expect(response.status).toBe(403);
      }
    });
  });
});
