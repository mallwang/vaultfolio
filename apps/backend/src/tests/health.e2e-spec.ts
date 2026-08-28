import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app/app.module';
import { DatabaseService } from '../database/database.service';

/**
 * Integration test for GET /health (contracts/health-api.md).
 * Issues a real HTTP request against a running Nest app instance via
 * supertest — not an in-memory call — per Principle IV.
 */
describe('GET /health', () => {
  let app: INestApplication;

  const buildApp = async (databaseService: Partial<DatabaseService>) => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(databaseService)
      .compile();

    const nestApp = moduleRef.createNestApplication();
    await nestApp.init();
    return nestApp;
  };

  afterEach(async () => {
    await app?.close();
  });

  it('returns 200 with status "ok" when the database is reachable', async () => {
    app = await buildApp({ ping: async () => true });

    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      database: 'connected',
    });
    expect(typeof response.body.timestamp).toBe('string');
    expect(() => new Date(response.body.timestamp)).not.toThrow();
  });

  it('returns 503 with status "degraded" when the database is unreachable', async () => {
    app = await buildApp({ ping: async () => false });

    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'degraded',
      database: 'unreachable',
    });
  });
});
