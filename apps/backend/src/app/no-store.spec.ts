import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureNoStore } from './no-store';

@Controller()
class EchoController {
  @Get('data')
  data() {
    return { value: 1 };
  }
}

describe('configureNoStore', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [EchoController] }).compile();
    app = moduleRef.createNestApplication();
    configureNoStore(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('marks a response as not cacheable', async () => {
    const response = await request(app.getHttpServer()).get('/data');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('marks an error response as not cacheable too', async () => {
    const response = await request(app.getHttpServer()).get('/missing');
    expect(response.status).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
