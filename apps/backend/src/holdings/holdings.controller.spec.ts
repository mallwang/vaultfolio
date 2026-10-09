import { randomBytes } from 'node:crypto';
import type { Response } from 'express';
import type { CreateHoldingRequest } from '@vaultfolio/api-contract';
import type { DatabaseService } from '../database/database.service';
import { createTestDatabase, createTestKeyring } from '../encryption/encryption.testing';
import { HoldingsAvailableGuard } from './holdings-available.guard';
import { HoldingsController } from './holdings.controller';
import { HoldingsCryptoService } from './holdings-crypto.service';
import { HoldingsUnavailableException } from './holdings.exceptions';
import { HoldingsRepository } from './holdings.repository';
import { HoldingsService } from './holdings.service';

const user = { id: 'owner-1' } as never;
const etf: CreateHoldingRequest = {
  assetType: 'ETF',
  management: 'Trade Republic',
  isin: 'IE00B4L5Y983',
  name: 'iShares Core MSCI World',
  quantity: '10.5',
  purchasePrice: '75.1234',
};

describe('HoldingsController', () => {
  let database: DatabaseService;
  let dispose: () => Promise<void>;
  let controller: HoldingsController;
  let crypto: HoldingsCryptoService;
  let status: number | undefined;
  const res = {
    status: (code: number) => {
      status = code;
    },
  } as unknown as Response;

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
    ({ database, dispose } = await createTestDatabase());
    crypto = new HoldingsCryptoService(createTestKeyring(database));
    controller = new HoldingsController(
      new HoldingsService(new HoldingsRepository(database, crypto)),
    );
  });

  afterAll(async () => {
    await dispose();
    delete process.env.ENCRYPTION_KEY;
  });

  beforeEach(() => {
    status = undefined;
    database.querySync('DELETE FROM holdings');
  });

  it('answers 201 on create and 200 on merge, with the same id', () => {
    const created = controller.create(etf, user, res) as { id: string; quantity: string };
    expect(status).toBe(201);
    expect(created.quantity).toBe('10.5');
    const merged = controller.create({ ...etf, quantity: '20' }, user, res) as {
      id: string;
      quantity: string;
    };
    expect(status).toBe(200);
    expect(merged.id).toBe(created.id);
    expect(merged.quantity).toBe('20');
    expect(controller.list(user)).toHaveLength(1);
  });

  it('answers 400 with {message, errors} for an invalid body', () => {
    const body = controller.create({ ...etf, isin: 'bad' }, user, res);
    expect(status).toBe(400);
    expect(body).toEqual({
      message: 'One or more fields are invalid.',
      errors: [{ field: 'isin', code: 'ISIN_INVALID' }],
    });
  });

  it('answers 404 for update and delete of an unknown or foreign id', () => {
    const created = controller.create(etf, user, res) as { id: string };
    const notFound = { error: 'HOLDING_NOT_FOUND', message: 'This holding no longer exists.' };
    const other = { id: 'owner-2' } as never;
    expect(controller.update(created.id, etf as never, other, res)).toEqual(notFound);
    expect(status).toBe(404);
    expect(controller.delete(created.id, other, res)).toEqual(notFound);
    expect(status).toBe(404);
    expect(controller.delete(created.id, user, res)).toBeUndefined();
    expect(status).toBe(204);
  });

  it('guard fails closed with 503 HOLDINGS_UNAVAILABLE when the key is unavailable', () => {
    expect(new HoldingsAvailableGuard(crypto).canActivate()).toBe(true);
    const locked = new HoldingsAvailableGuard({ available: false } as HoldingsCryptoService);
    expect(() => locked.canActivate()).toThrow(HoldingsUnavailableException);
    try {
      locked.canActivate();
    } catch (e) {
      expect((e as HoldingsUnavailableException).getStatus()).toBe(503);
    }
  });
});
