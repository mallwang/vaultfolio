import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../app/app.module';
import { DatabaseService } from '../database/database.service';

/**
 * Integration tests for `/api/auth/*` (contracts/auth-api.md), User Story 1.
 * Real HTTP requests via `supertest` against a real temp-file SQLite DB, per
 * Principle IV — T025–T029.
 */
describe('/auth', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let tempDir: string;

  const ADMIN_EMAIL = 'admin@example.com';
  const ADMIN_PASSWORD = 'a-valid-8-char-password';

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-auth-e2e-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    process.env.BOOTSTRAP_ADMIN_EMAIL = ADMIN_EMAIL;
    process.env.BOOTSTRAP_ADMIN_PASSWORD = ADMIN_PASSWORD;
    process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES = '30';
    process.env.SESSION_ABSOLUTE_LIFETIME_HOURS = '12';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    database = moduleRef.get(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
    delete process.env.DATABASE_PATH;
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    delete process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES;
    delete process.env.SESSION_ABSOLUTE_LIFETIME_HOURS;
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

  describe('POST /auth/sign-in', () => {
    it('returns 200 + SessionUser + Set-Cookie for valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        email: ADMIN_EMAIL,
        displayName: 'Administrator',
        role: 'ADMIN',
      });
      expect(typeof response.body.id).toBe('string');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('returns 401 invalid_credentials for a wrong password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email: ADMIN_EMAIL, password: 'wrong-password' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'invalid_credentials',
        message: 'Invalid email or password.',
      });
    });

    it('returns a byte-for-byte identical 401 body for a nonexistent email (FR-008, SC-005)', async () => {
      const wrongPassword = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email: ADMIN_EMAIL, password: 'wrong-password-2' });
      const nonexistentEmail = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email: 'nobody@example.com', password: 'whatever-password' });

      expect(nonexistentEmail.status).toBe(401);
      expect(nonexistentEmail.body).toEqual(wrongPassword.body);
    });
  });

  describe('GET /auth/session', () => {
    it('returns SessionUser with a valid cookie, 401 without one', async () => {
      const signIn = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
      const cookie = extractCookie(signIn);

      const withCookie = await request(app.getHttpServer())
        .get('/auth/session')
        .set('Cookie', cookie);
      expect(withCookie.status).toBe(200);
      expect(withCookie.body.email).toBe(ADMIN_EMAIL);

      const withoutCookie = await request(app.getHttpServer()).get('/auth/session');
      expect(withoutCookie.status).toBe(401);
      expect(withoutCookie.body).toEqual({
        error: 'unauthenticated',
        message: 'Sign in required.',
      });
    });

    it('protects an existing route (GET /holdings): 401 without cookie, 200 with', async () => {
      const signIn = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
      const cookie = extractCookie(signIn);

      const withoutCookie = await request(app.getHttpServer()).get('/holdings');
      expect(withoutCookie.status).toBe(401);

      const withCookie = await request(app.getHttpServer()).get('/holdings').set('Cookie', cookie);
      expect(withCookie.status).toBe(200);
    });
  });

  describe('POST /auth/sign-out', () => {
    it('destroys the session server-side: 204, then the stale cookie 401s', async () => {
      const signIn = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
      const cookie = extractCookie(signIn);

      const signOut = await request(app.getHttpServer())
        .post('/auth/sign-out')
        .set('Cookie', cookie);
      expect(signOut.status).toBe(204);

      const stale = await request(app.getHttpServer()).get('/auth/session').set('Cookie', cookie);
      expect(stale.status).toBe(401);
    });
  });

  describe('Account lockout (FR-007, SC-004)', () => {
    it('locks the account on the 6th consecutive wrong-password attempt, with escalating delay', async () => {
      const email = 'lockout-target@example.com';
      // Create a dedicated account for this test so its lockout state can't
      // interfere with the other describe blocks' use of the bootstrap admin.
      await database.query(
        `INSERT INTO users (id, email, display_name, password_hash, role)
         VALUES ('lockout-user', $1, 'Lockout Target', $2, 'MEMBER')`,
        [email, await argon2.hash('correct-password')],
      );

      let lastResponse: request.Response | undefined;
      for (let i = 0; i < 6; i++) {
        lastResponse = await request(app.getHttpServer())
          .post('/auth/sign-in')
          .send({ email, password: 'wrong-password' });
      }

      expect(lastResponse?.status).toBe(429);
      expect(lastResponse?.body).toEqual({
        error: 'account_locked',
        message: 'Too many failed attempts. Try again later.',
      });

      // Further attempts stay locked with an escalated delay (still 429).
      const again = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email, password: 'wrong-password' });
      expect(again.status).toBe(429);
    });
  });

  describe('Session expiry (FR-004)', () => {
    it('rejects a session past its inactivity timeout on next use', async () => {
      const signIn = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
      const cookie = extractCookie(signIn);
      const sessionId = cookie.split('=')[1];

      // Force the session's last_active_at into the past, beyond the
      // configured inactivity timeout, rather than waiting in real time.
      await database.query(`UPDATE sessions SET last_active_at = $2 WHERE id = $1`, [
        sessionId,
        new Date(Date.now() - 31 * 60_000).toISOString(),
      ]);

      const response = await request(app.getHttpServer())
        .get('/auth/session')
        .set('Cookie', cookie);
      expect(response.status).toBe(401);
    });
  });
});
