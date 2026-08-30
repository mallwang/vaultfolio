import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as argon2 from 'argon2';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../app/app.module';
import { UsersRepository } from '../auth/users.repository';
import { SessionsRepository } from '../auth/sessions.repository';
import { AccountActionTokensRepository } from './account-action-tokens.repository';
import { EmailService } from './email.service';

/**
 * Integration tests for `/api/profile/*` (contracts/profile-api.md), User
 * Stories 1–3. Real HTTP requests via `supertest` against a real temp-file
 * SQLite DB (Principle IV) — session invalidation, purpose isolation,
 * forgot-password response-uniformity, and the last-admin-blocked self-
 * delete path (research.md #1, closing the MEMBER-reachability gap).
 * `EmailService` is overridden with jest mocks so no real SMTP transport is
 * ever exercised.
 */
describe('/profile', () => {
  let app: INestApplication;
  let users: UsersRepository;
  let sessions: SessionsRepository;
  let tokens: AccountActionTokensRepository;
  let tempDir: string;
  let sendEmailChangeVerification: jest.Mock;
  let sendPasswordReset: jest.Mock;

  const ADMIN_EMAIL = 'admin@example.com';
  const ADMIN_PASSWORD = 'a-valid-8-char-password';
  const PASSWORD = 'a-valid-8-char-password';

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-profile-e2e-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    process.env.BOOTSTRAP_ADMIN_EMAIL = ADMIN_EMAIL;
    process.env.BOOTSTRAP_ADMIN_PASSWORD = ADMIN_PASSWORD;
    process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES = '30';
    process.env.SESSION_ABSOLUTE_LIFETIME_HOURS = '12';
    process.env.ACCOUNT_RETENTION_DAYS = '30';
    process.env.EMAIL_CHANGE_EXPIRY_HOURS = '24';
    process.env.PASSWORD_RESET_EXPIRY_HOURS = '1';

    sendEmailChangeVerification = jest.fn().mockResolvedValue(undefined);
    sendPasswordReset = jest.fn().mockResolvedValue(undefined);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue({ sendEmailChangeVerification, sendPasswordReset })
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    users = moduleRef.get(UsersRepository);
    sessions = moduleRef.get(SessionsRepository);
    tokens = moduleRef.get(AccountActionTokensRepository);
  });

  afterAll(async () => {
    await app.close();
    delete process.env.DATABASE_PATH;
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    delete process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES;
    delete process.env.SESSION_ABSOLUTE_LIFETIME_HOURS;
    delete process.env.ACCOUNT_RETENTION_DAYS;
    delete process.env.EMAIL_CHANGE_EXPIRY_HOURS;
    delete process.env.PASSWORD_RESET_EXPIRY_HOURS;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    sendEmailChangeVerification.mockClear();
    sendPasswordReset.mockClear();
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

  /**
   * Builds a session cookie directly via `SessionsRepository` rather than
   * hitting the throttled `/auth/sign-in` route (20/60s, AuthModule) — this
   * file creates far more test members than that limit allows within a
   * single test run.
   */
  async function sessionCookieFor(userId: string): Promise<string> {
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    const session = await sessions.create(userId, expiresAt);
    return `vaultfolio_session=${session.id}`;
  }

  async function createMember(email: string): Promise<{ id: string; cookie: string }> {
    const passwordHash = await argon2.hash(PASSWORD);
    const user = await users.create({
      email,
      displayName: 'Member User',
      passwordHash,
      role: 'MEMBER',
    });
    const cookie = await sessionCookieFor(user.id);
    return { id: user.id, cookie };
  }

  let cachedAdminCookie: string | undefined;
  /** Memoized — the sign-in route is rate-limited (20/60s). */
  async function adminCookie(): Promise<string> {
    if (!cachedAdminCookie) {
      cachedAdminCookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
    }
    return cachedAdminCookie;
  }

  describe('GET /profile', () => {
    it('returns the caller own profile', async () => {
      const { cookie } = await createMember('get-profile@example.com');
      const response = await request(app.getHttpServer()).get('/profile').set('Cookie', cookie);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        email: 'get-profile@example.com',
        displayName: 'Member User',
        role: 'MEMBER',
        pendingEmail: null,
        emailLanguage: null,
      });
    });

    it('401s when unauthenticated', async () => {
      const response = await request(app.getHttpServer()).get('/profile');
      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /profile/display-name', () => {
    it('updates the display name: 200', async () => {
      const { cookie } = await createMember('display-name@example.com');
      const response = await request(app.getHttpServer())
        .patch('/profile/display-name')
        .set('Cookie', cookie)
        .send({ displayName: 'New Name' });
      expect(response.status).toBe(200);
      expect(response.body.displayName).toBe('New Name');
    });

    it('returns 400 invalid_display_name for an empty name', async () => {
      const { cookie } = await createMember('display-name-empty@example.com');
      const response = await request(app.getHttpServer())
        .patch('/profile/display-name')
        .set('Cookie', cookie)
        .send({ displayName: '' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_display_name');
    });

    it('returns 400 invalid_display_name for a name over 100 characters', async () => {
      const { cookie } = await createMember('display-name-long@example.com');
      const response = await request(app.getHttpServer())
        .patch('/profile/display-name')
        .set('Cookie', cookie)
        .send({ displayName: 'a'.repeat(101) });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_display_name');
    });
  });

  describe('PATCH /profile/email-language', () => {
    it('sets a valid supported code: 200', async () => {
      const { cookie } = await createMember('email-language@example.com');
      const response = await request(app.getHttpServer())
        .patch('/profile/email-language')
        .set('Cookie', cookie)
        .send({ emailLanguage: 'de' });
      expect(response.status).toBe(200);
      expect(response.body.emailLanguage).toBe('de');
    });

    it('clears the setting with null: 200', async () => {
      const { cookie } = await createMember('email-language-clear@example.com');
      await request(app.getHttpServer())
        .patch('/profile/email-language')
        .set('Cookie', cookie)
        .send({ emailLanguage: 'de' });
      const response = await request(app.getHttpServer())
        .patch('/profile/email-language')
        .set('Cookie', cookie)
        .send({ emailLanguage: null });
      expect(response.status).toBe(200);
      expect(response.body.emailLanguage).toBeNull();
    });

    it('returns 400 invalid_email_language for an unsupported code', async () => {
      const { cookie } = await createMember('email-language-invalid@example.com');
      const response = await request(app.getHttpServer())
        .patch('/profile/email-language')
        .set('Cookie', cookie)
        .send({ emailLanguage: 'fr' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_email_language');
    });

    it('401s when unauthenticated', async () => {
      const response = await request(app.getHttpServer())
        .patch('/profile/email-language')
        .send({ emailLanguage: 'de' });
      expect(response.status).toBe(401);
    });

    it('does not affect the display language (FR-009 — no client-side coupling)', async () => {
      const { cookie } = await createMember('email-language-independent@example.com');
      await request(app.getHttpServer())
        .patch('/profile/email-language')
        .set('Cookie', cookie)
        .send({ emailLanguage: 'de' });
      const response = await request(app.getHttpServer()).get('/profile').set('Cookie', cookie);
      expect(response.body.emailLanguage).toBe('de');
      // The display language is a per-device localStorage concern the
      // backend never stores or reads — nothing else on the profile
      // response changes as a result of setting this field.
      expect(response.body.displayName).toBe('Member User');
    });
  });

  describe('Email change: request -> verify (old address stays active)', () => {
    it('202s, sends a verification email, and the old address stays usable for sign-in', async () => {
      const { cookie } = await createMember('email-change-flow@example.com');

      const requestResponse = await request(app.getHttpServer())
        .post('/profile/email-change')
        .set('Cookie', cookie)
        .send({ newEmail: 'new-address@example.com' });
      expect(requestResponse.status).toBe(202);
      expect(requestResponse.body).toEqual({ pendingEmail: 'new-address@example.com' });
      expect(sendEmailChangeVerification).toHaveBeenCalledTimes(1);
      const token = sendEmailChangeVerification.mock.calls[0][2] as string;

      // Old address still signs in — the change isn't applied yet.
      const stillWorks = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email: 'email-change-flow@example.com', password: PASSWORD });
      expect(stillWorks.status).toBe(200);

      const lookup = await request(app.getHttpServer()).get(`/profile/email-change/token/${token}`);
      expect(lookup.status).toBe(200);
      expect(lookup.body).toEqual({ newEmail: 'new-address@example.com' });

      const confirm = await request(app.getHttpServer()).post(
        `/profile/email-change/token/${token}/confirm`,
      );
      expect(confirm.status).toBe(200);
      expect(confirm.body).toEqual({ email: 'new-address@example.com' });

      // Confirming again (replay) is now invalid.
      const replay = await request(app.getHttpServer()).post(
        `/profile/email-change/token/${token}/confirm`,
      );
      expect(replay.status).toBe(410);
      expect(replay.body.error).toBe('invalid_token');
    });

    it('returns 409 email_unavailable when the target email already has an account', async () => {
      const { cookie } = await createMember('conflict-check@example.com');
      const response = await request(app.getHttpServer())
        .post('/profile/email-change')
        .set('Cookie', cookie)
        .send({ newEmail: ADMIN_EMAIL });
      expect(response.status).toBe(409);
      expect(response.body.error).toBe('email_unavailable');
    });

    it('supersedes a prior pending request on resubmit', async () => {
      const { cookie, id } = await createMember('resubmit@example.com');
      await request(app.getHttpServer())
        .post('/profile/email-change')
        .set('Cookie', cookie)
        .send({ newEmail: 'first-target@example.com' });
      await request(app.getHttpServer())
        .post('/profile/email-change')
        .set('Cookie', cookie)
        .send({ newEmail: 'second-target@example.com' });

      const pending = await tokens.findPendingByUserAndPurpose(id, 'EMAIL_CHANGE');
      expect(pending?.newEmail).toBe('second-target@example.com');
    });

    it('cancel is idempotent and clears the pending request', async () => {
      const { cookie, id } = await createMember('cancel-flow@example.com');
      await request(app.getHttpServer())
        .post('/profile/email-change')
        .set('Cookie', cookie)
        .send({ newEmail: 'cancel-target@example.com' });

      const first = await request(app.getHttpServer())
        .post('/profile/email-change/cancel')
        .set('Cookie', cookie);
      expect(first.status).toBe(204);
      expect(await tokens.findPendingByUserAndPurpose(id, 'EMAIL_CHANGE')).toBeNull();

      const second = await request(app.getHttpServer())
        .post('/profile/email-change/cancel')
        .set('Cookie', cookie);
      expect(second.status).toBe(204);
    });

    it('GET token lookup returns 410 invalid_token for an unknown token', async () => {
      const response = await request(app.getHttpServer()).get(
        '/profile/email-change/token/does-not-exist',
      );
      expect(response.status).toBe(410);
      expect(response.body).toEqual({
        error: 'invalid_token',
        message: 'This link is no longer valid.',
      });
    });
  });

  describe('POST /profile/password — session invalidation', () => {
    it('changes the password and invalidates other sessions but not the acting one', async () => {
      const { id, cookie: sessionA } = await createMember('two-sessions@example.com');
      const sessionB = await sessionCookieFor(id);

      const response = await request(app.getHttpServer())
        .post('/profile/password')
        .set('Cookie', sessionA)
        .send({ currentPassword: PASSWORD, newPassword: 'brand-new-password-1' });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ changed: true });

      const stillWorksA = await request(app.getHttpServer())
        .get('/profile')
        .set('Cookie', sessionA);
      expect(stillWorksA.status).toBe(200);

      const invalidatedB = await request(app.getHttpServer())
        .get('/profile')
        .set('Cookie', sessionB);
      expect(invalidatedB.status).toBe(401);
    });

    it('returns 401 invalid_current_password on a wrong current password', async () => {
      const { cookie } = await createMember('wrong-current@example.com');
      const response = await request(app.getHttpServer())
        .post('/profile/password')
        .set('Cookie', cookie)
        .send({ currentPassword: 'not-the-password', newPassword: 'brand-new-password-1' });
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('invalid_current_password');
    });

    it('returns 400 invalid_password when the new password fails policy', async () => {
      const { cookie } = await createMember('bad-new-password@example.com');
      const response = await request(app.getHttpServer())
        .post('/profile/password')
        .set('Cookie', cookie)
        .send({ currentPassword: PASSWORD, newPassword: 'short' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_password');
    });
  });

  describe('POST /profile/forgot-password — uniform response', () => {
    it('produces byte-identical response bodies for an existing vs. nonexistent address', async () => {
      await createMember('forgot-exists@example.com');

      const existing = await request(app.getHttpServer())
        .post('/profile/forgot-password')
        .send({ email: 'forgot-exists@example.com' });
      const nonexistent = await request(app.getHttpServer())
        .post('/profile/forgot-password')
        .send({ email: 'forgot-does-not-exist@example.com' });

      expect(existing.status).toBe(nonexistent.status);
      expect(existing.status).toBe(200);
      expect(JSON.stringify(existing.body)).toBe(JSON.stringify(nonexistent.body));
      expect(existing.body).toEqual({ accepted: true });
    });

    it('sends a reset email only for the existing account', async () => {
      await createMember('forgot-sends-email@example.com');
      sendPasswordReset.mockClear();

      await request(app.getHttpServer())
        .post('/profile/forgot-password')
        .send({ email: 'forgot-sends-email@example.com' });
      expect(sendPasswordReset).toHaveBeenCalledTimes(1);

      sendPasswordReset.mockClear();
      await request(app.getHttpServer())
        .post('/profile/forgot-password')
        .send({ email: 'no-such-account@example.com' });
      expect(sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe('Password reset via link', () => {
    it('resets the password, invalidates all sessions, and signs the user in', async () => {
      const { cookie: oldSession } = await createMember('reset-flow@example.com');
      sendPasswordReset.mockClear();
      await request(app.getHttpServer())
        .post('/profile/forgot-password')
        .send({ email: 'reset-flow@example.com' });
      const token = sendPasswordReset.mock.calls[0][1] as string;

      const lookup = await request(app.getHttpServer()).get(
        `/profile/reset-password/token/${token}`,
      );
      expect(lookup.status).toBe(200);
      expect(lookup.body).toEqual({ valid: true });

      const confirm = await request(app.getHttpServer())
        .post(`/profile/reset-password/token/${token}/confirm`)
        .send({ newPassword: 'reset-new-password-1' });
      expect(confirm.status).toBe(200);
      expect(confirm.body).toMatchObject({ email: 'reset-flow@example.com' });
      expect(confirm.headers['set-cookie']).toBeDefined();

      // The pre-reset session is gone.
      const staleSession = await request(app.getHttpServer())
        .get('/profile')
        .set('Cookie', oldSession);
      expect(staleSession.status).toBe(401);

      // The new password works.
      const signInResponse = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email: 'reset-flow@example.com', password: 'reset-new-password-1' });
      expect(signInResponse.status).toBe(200);
    });

    it('returns 400 invalid_password without consuming the token', async () => {
      await createMember('reset-bad-password@example.com');
      sendPasswordReset.mockClear();
      await request(app.getHttpServer())
        .post('/profile/forgot-password')
        .send({ email: 'reset-bad-password@example.com' });
      const token = sendPasswordReset.mock.calls[0][1] as string;

      const badAttempt = await request(app.getHttpServer())
        .post(`/profile/reset-password/token/${token}/confirm`)
        .send({ newPassword: 'short' });
      expect(badAttempt.status).toBe(400);
      expect(badAttempt.body.error).toBe('invalid_password');

      // Token is still usable afterwards.
      const goodAttempt = await request(app.getHttpServer())
        .post(`/profile/reset-password/token/${token}/confirm`)
        .send({ newPassword: 'good-enough-password-1' });
      expect(goodAttempt.status).toBe(200);
    });

    it('returns 410 invalid_token for an unknown reset token', async () => {
      const response = await request(app.getHttpServer()).get(
        '/profile/reset-password/token/does-not-exist',
      );
      expect(response.status).toBe(410);
      expect(response.body.error).toBe('invalid_token');
    });
  });

  describe('A PASSWORD_RESET token never satisfies an EMAIL_CHANGE lookup and vice versa', () => {
    it('rejects cross-purpose token usage on both lookup endpoints', async () => {
      const { cookie } = await createMember('cross-purpose@example.com');
      await request(app.getHttpServer())
        .post('/profile/email-change')
        .set('Cookie', cookie)
        .send({ newEmail: 'cross-purpose-new@example.com' });
      const emailChangeToken = sendEmailChangeVerification.mock.calls.at(-1)?.[2] as string;

      sendPasswordReset.mockClear();
      await request(app.getHttpServer())
        .post('/profile/forgot-password')
        .send({ email: 'cross-purpose@example.com' });
      const passwordResetToken = sendPasswordReset.mock.calls.at(-1)?.[1] as string;

      const emailChangeAsReset = await request(app.getHttpServer()).get(
        `/profile/reset-password/token/${emailChangeToken}`,
      );
      expect(emailChangeAsReset.status).toBe(410);

      const resetAsEmailChange = await request(app.getHttpServer()).get(
        `/profile/email-change/token/${passwordResetToken}`,
      );
      expect(resetAsEmailChange.status).toBe(410);
    });
  });

  describe('DELETE /profile/account', () => {
    it('a MEMBER account (unreachable via /api/accounts/:id) can self-delete: 204', async () => {
      const { cookie } = await createMember('self-delete-member@example.com');

      const response = await request(app.getHttpServer())
        .delete('/profile/account')
        .set('Cookie', cookie);
      expect(response.status).toBe(204);

      const postDelete = await request(app.getHttpServer()).get('/profile').set('Cookie', cookie);
      expect(postDelete.status).toBe(401);
    });

    it('blocks the sole active administrator with 409, then succeeds once a second admin exists', async () => {
      const cookie = await adminCookie();

      const blocked = await request(app.getHttpServer())
        .delete('/profile/account')
        .set('Cookie', cookie);
      expect(blocked.status).toBe(409);
      expect(blocked.body.error).toBe('last_admin');

      const secondAdminHash = await argon2.hash(PASSWORD);
      await users.create({
        email: 'second-admin@example.com',
        displayName: 'Second Admin',
        passwordHash: secondAdminHash,
        role: 'ADMIN',
      });

      const succeeds = await request(app.getHttpServer())
        .delete('/profile/account')
        .set('Cookie', cookie);
      expect(succeeds.status).toBe(204);

      cachedAdminCookie = undefined;
    });
  });
});
