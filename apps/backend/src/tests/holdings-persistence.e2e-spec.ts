import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
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
 */
describe('Holdings persistence across app module restart (SC-002)', () => {
  let tempDir: string;
  let databasePath: string;

  const validGold: CreateHoldingRequest = {
    assetType: 'GOLD',
    management: 'Home safe',
    weightGrams: '12.34567891',
  };

  const buildApp = async (): Promise<INestApplication> => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    return app;
  };

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-persistence-'));
    databasePath = path.join(tempDir, 'vaultfolio.db');
    process.env.DATABASE_PATH = databasePath;
  });

  afterAll(() => {
    delete process.env.DATABASE_PATH;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('keeps a holding readable after the app is closed and a fresh instance opens the same file', async () => {
    const firstApp = await buildApp();
    const created = await request(firstApp.getHttpServer()).post('/holdings').send(validGold);
    expect(created.status).toBe(201);
    await firstApp.close();

    // The database file (and its -wal/-shm siblings) survives the app close,
    // exactly as a bind-mounted ./data directory survives `docker compose down`.
    expect(fs.existsSync(databasePath)).toBe(true);

    const secondApp = await buildApp();
    try {
      const response = await request(secondApp.getHttpServer()).get('/holdings');

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
