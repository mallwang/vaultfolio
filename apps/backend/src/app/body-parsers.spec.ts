import { Body, Controller, type INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureBodyParsers } from './body-parsers';

@Controller()
class EchoController {
  @Post('requests')
  requests(@Body() body: unknown) {
    return { received: typeof body === 'object' && body !== null ? Object.keys(body) : [] };
  }

  @Post('other')
  other(@Body() body: unknown) {
    return { received: typeof body === 'object' && body !== null ? Object.keys(body) : [] };
  }
}

/** A JSON body whose serialised size is `bytes` bytes. */
function jsonOfSize(bytes: number): string {
  const overhead = JSON.stringify({ pad: '' }).length;
  return JSON.stringify({ pad: 'x'.repeat(bytes - overhead) });
}

describe('configureBodyParsers', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [EchoController] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    configureBodyParsers(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (url: string, body: string, type = 'application/json') =>
    request(app.getHttpServer()).post(url).set('Content-Type', type).send(body);

  it('accepts a 511 kB body on /requests', async () => {
    const response = await post('/requests', jsonOfSize(511 * 1024));
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ received: ['pad'] });
  });

  it('rejects a 513 kB body on /requests as payload_too_large', async () => {
    const response = await post('/requests', jsonOfSize(513 * 1024));
    expect(response.status).toBe(413);
    expect(response.body.error).toBe('payload_too_large');
  });

  it('keeps the 100 kB limit on every other route', async () => {
    expect((await post('/other', jsonOfSize(99 * 1024))).status).toBe(201);
    const response = await post('/other', jsonOfSize(101 * 1024));
    expect(response.status).toBe(413);
    expect(response.body.error).toBe('payload_too_large');
  });

  it('does not parse a non-JSON body on /requests (the controller answers 415)', async () => {
    const response = await post('/requests', 'pad=1', 'text/plain');
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ received: [] });
  });
});
