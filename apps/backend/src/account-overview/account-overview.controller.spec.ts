import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { AccountOverviewController } from './account-overview.controller';
import { AccountOverviewService } from './account-overview.service';
import type { Account } from '@vaultfolio/domain-accounts';

/**
 * Response-shape tests for each endpoint's success/error contract per
 * contracts/account-overview-api.md, mirroring `holdings.controller.spec.ts`'s
 * style — the service is mocked so only the controller's status-code/body
 * translation is under test.
 */
describe('AccountOverviewController', () => {
  let controller: AccountOverviewController;
  let service: {
    findAll: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  const account: Account = {
    id: 'a1',
    name: 'N26 checking',
    category: 'GENERAL',
    status: 'ACTIVE',
    provider: 'N26',
    website: 'https://n26.com',
    purpose: 'Everyday spending',
    cardUsage: null,
    requiredMinimum: null,
    notes: null,
    cardNumber: null,
    validUntil: null,
    ownerId: 'owner-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  const user = { id: 'owner-1', role: 'MEMBER' as const, domainScopes: ['account-overview'] };

  const fakeResponse = (): Response & { status: jest.Mock } => {
    const res: { status: jest.Mock; statusCode?: number } = {
      status: jest.fn(function (this: unknown, code: number) {
        (this as { statusCode: number }).statusCode = code;
        return this;
      }),
    };
    return res as unknown as Response & { status: jest.Mock };
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AccountOverviewController],
      providers: [{ provide: AccountOverviewService, useValue: service }],
    }).compile();

    controller = moduleRef.get(AccountOverviewController);
  });

  it('GET list() returns 200 with the mapped account list', async () => {
    service.findAll.mockResolvedValue([account]);

    const result = await controller.list(user);

    expect(result).toEqual([
      {
        id: 'a1',
        name: 'N26 checking',
        category: 'GENERAL',
        status: 'ACTIVE',
        provider: 'N26',
        website: 'https://n26.com',
        purpose: 'Everyday spending',
        cardUsage: null,
        requiredMinimum: null,
        notes: null,
        cardNumber: null,
        validUntil: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
  });

  it('POST create() returns 201 with the created account on success', async () => {
    service.create.mockResolvedValue({ kind: 'created', account });
    const res = fakeResponse();

    const result = await controller.create({ name: 'N26 checking' }, user, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(result).toMatchObject({ id: 'a1', name: 'N26 checking' });
  });

  it('POST create() returns 400 with fieldErrors on validation failure', async () => {
    service.create.mockResolvedValue({
      kind: 'invalid',
      fieldErrors: [{ field: 'name', message: 'Name is required.' }],
    });
    const res = fakeResponse();

    const result = await controller.create({ name: '' }, user, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(result).toEqual({
      error: 'VALIDATION_FAILED',
      message: 'One or more fields are invalid.',
      fieldErrors: [{ field: 'name', message: 'Name is required.' }],
    });
  });

  it('PUT update() returns 200 with the updated account on success', async () => {
    service.update.mockResolvedValue({ kind: 'updated', account });
    const res = fakeResponse();

    const result = await controller.update('a1', { name: 'Renamed' }, user, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(result).toMatchObject({ id: 'a1' });
  });

  it('PUT update() returns 400 on validation failure', async () => {
    service.update.mockResolvedValue({
      kind: 'invalid',
      fieldErrors: [{ field: 'name', message: 'Name is required.' }],
    });
    const res = fakeResponse();

    const result = await controller.update('a1', { name: '' }, user, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(result).toMatchObject({ error: 'VALIDATION_FAILED' });
  });

  it('PUT update() returns 404 when the account does not resolve for this caller', async () => {
    service.update.mockResolvedValue({ kind: 'not_found' });
    const res = fakeResponse();

    const result = await controller.update('missing', { name: 'X' }, user, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(result).toEqual({
      error: 'ACCOUNT_NOT_FOUND',
      message: 'This account no longer exists.',
    });
  });

  it('DELETE delete() returns 204 with no body on success', async () => {
    service.delete.mockResolvedValue(true);
    const res = fakeResponse();

    const result = await controller.delete('a1', user, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(result).toBeUndefined();
  });

  it('DELETE delete() returns 404 when the account does not exist for this caller', async () => {
    service.delete.mockResolvedValue(false);
    const res = fakeResponse();

    const result = await controller.delete('missing', user, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(result).toEqual({
      error: 'ACCOUNT_NOT_FOUND',
      message: 'This account no longer exists.',
    });
  });
});
