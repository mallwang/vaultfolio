import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app/app.module';
import { DatabaseService } from '../database/database.service';

/**
 * Integration test for the observability feature's error-response contract
 * (specs/030-observability-logging-error-handling/contracts/error-response.md, Principle IV):
 * an unhandled exception on any real endpoint produces an `ErrorResponse` body with a
 * `correlationId`, the `X-Correlation-Id` response header round-trips a supplied valid UUID
 * unchanged, and a malformed supplied header results in a freshly generated (different) UUID
 * rather than being reflected back.
 */
describe('Backend error response contract (US1)', () => {
  let app: INestApplication;
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({ ping: async () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('carries a correlationId and X-Correlation-Id header on an unhandled exception', async () => {
    const response = await request(app.getHttpServer()).get('/accounts');

    expect(response.status).toBe(401);
    expect(response.headers['x-correlation-id']).toMatch(UUID_PATTERN);
    expect(response.body).toMatchObject({
      error: 'unauthenticated',
      message: 'Sign in required.',
    });
    expect(response.body.correlationId).toBe(response.headers['x-correlation-id']);
  });

  it('reuses a supplied valid X-Correlation-Id verbatim', async () => {
    const suppliedId = '11111111-1111-4111-8111-111111111111';

    const response = await request(app.getHttpServer())
      .get('/accounts')
      .set('X-Correlation-Id', suppliedId);

    expect(response.headers['x-correlation-id']).toBe(suppliedId);
    expect(response.body.correlationId).toBe(suppliedId);
  });

  it('ignores a malformed inbound header and generates a fresh UUID instead', async () => {
    const response = await request(app.getHttpServer())
      .get('/accounts')
      .set('X-Correlation-Id', 'not-a-uuid');

    expect(response.headers['x-correlation-id']).not.toBe('not-a-uuid');
    expect(response.headers['x-correlation-id']).toMatch(UUID_PATTERN);
    expect(response.body.correlationId).toBe(response.headers['x-correlation-id']);
  });
});
