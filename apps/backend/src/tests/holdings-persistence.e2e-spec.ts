import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { CreateHoldingRequest } from '@vaultfolio/api-contract';
import { AppModule } from '../app/app.module';

/**
 * Integration test for the stop/remove/recreate persistence scenario
 * (SC-002, quickstart.md #2, Principle IV obligation): a holding written
 * against a `DATABASE_PATH` file survives closing the Nest app module
 * (simulating a container being torn down) and booting a fresh app instance
 * against the same file — the same guarantee a `./data` bind mount gives an
 * operator across `docker compose down && docker compose up`.
 *
 * 005-auth-sessions-isolation: the bootstrap admin (seeded from env vars on
 * first boot) signs in on each app instance to obtain a session cookie,
 * since every route now requires authentication (FR-001). The admin account
 * itself persists across restarts the same way the holding does.
 */
describe('Holdings persistence across app module restart (SC-002)', () => {
  let tempDir: string;
  let databasePath: string;

  const ADMIN_EMAIL = 'admin@example.com';
  const ADMIN_PASSWORD = 'a-valid-8-char-password';

  const validGold: CreateHoldingRequest = {
    assetType: 'GOLD',
    management: 'Home safe',
    weightGrams: '12.34567891',
  };

  const buildApp = async (): Promise<{ app: INestApplication; cookie: string }> => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const signIn = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const setCookie = signIn.headers['set-cookie'] as unknown as string[];
    const cookie = setCookie[0].split(';')[0];

    return { app, cookie };
  };

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-persistence-'));
    databasePath = path.join(tempDir, 'vaultfolio.db');
    process.env.DATABASE_PATH = databasePath;
    process.env.BOOTSTRAP_ADMIN_EMAIL = ADMIN_EMAIL;
    process.env.BOOTSTRAP_ADMIN_PASSWORD = ADMIN_PASSWORD;
  });

  afterAll(() => {
    delete process.env.DATABASE_PATH;
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('keeps a holding readable after the app is closed and a fresh instance opens the same file', async () => {
    const { app: firstApp, cookie: firstCookie } = await buildApp();
    const created = await request(firstApp.getHttpServer())
      .post('/holdings')
      .set('Cookie', firstCookie)
      .send(validGold);
    expect(created.status).toBe(201);
    await firstApp.close();

    // The database file (and its -wal/-shm siblings) survives the app close,
    // exactly as a bind-mounted ./data directory survives `docker compose down`.
    expect(fs.existsSync(databasePath)).toBe(true);

    const { app: secondApp, cookie: secondCookie } = await buildApp();
    try {
      const response = await request(secondApp.getHttpServer())
        .get('/holdings')
        .set('Cookie', secondCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        assetType: 'GOLD',
        management: 'Home safe',
        weightGrams: '12.34567891',
      });
    } finally {
      await secondApp.close();
    }
  });
});
