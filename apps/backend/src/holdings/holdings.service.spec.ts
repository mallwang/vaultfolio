import { randomBytes } from 'node:crypto';
import type { CreateHoldingRequest } from '@vaultfolio/api-contract';
import type { DatabaseService } from '../database/database.service';
import { createTestDatabase, createTestKeyring } from '../encryption/encryption.testing';
import { HoldingsCryptoService } from './holdings-crypto.service';
import { HoldingsUnavailableException } from './holdings.exceptions';
import { HoldingsRepository } from './holdings.repository';
import { HoldingsService } from './holdings.service';

const etf: CreateHoldingRequest = {
  assetType: 'ETF',
  management: 'Trade Republic',
  isin: 'IE00B4L5Y983',
  name: 'iShares Core MSCI World',
  quantity: '10.5',
  purchasePrice: '75.1234',
};

describe('HoldingsService', () => {
  let database: DatabaseService;
  let dispose: () => Promise<void>;
  let service: HoldingsService;
  let crypto: HoldingsCryptoService;
  const owner = 'owner-1';

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
    ({ database, dispose } = await createTestDatabase());
    crypto = new HoldingsCryptoService(createTestKeyring(database));
    service = new HoldingsService(new HoldingsRepository(database, crypto));
  });

  afterAll(async () => {
    await dispose();
    delete process.env.ENCRYPTION_KEY;
  });

  beforeEach(() => {
    database.querySync('DELETE FROM holdings');
  });

  it('creates, stores only ciphertext and returns exact decimals', () => {
    const result = service.create(etf, owner);
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.holding.quantity?.toString()).toBe('10.5');
    expect(result.holding.purchasePrice?.toString()).toBe('75.1234');
    const [row] = database.querySync<{ payload_enc: string; key_version: number }>(
      'SELECT payload_enc, key_version FROM holdings',
    );
    expect(row.key_version).toBe(2);
    expect(row.payload_enc).not.toContain('Trade Republic');
    expect(row.payload_enc).not.toContain('IE00B4L5Y983');
  });

  it('merges an ETF with the same isin and management in place, keeping id and createdAt', () => {
    const first = service.create(etf, owner);
    const second = service.create({ ...etf, quantity: '20' }, owner);
    expect(second.kind).toBe('updated');
    if (first.kind === 'invalid' || second.kind === 'invalid') throw new Error('invalid');
    expect(second.holding.id).toBe(first.holding.id);
    expect(second.holding.createdAt).toEqual(first.holding.createdAt);
    expect(second.holding.quantity?.toString()).toBe('20');
    expect(service.findAll(owner)).toHaveLength(1);
  });

  it('merges metals by metal and management, deposits by normalised name, never shares', () => {
    const metal: CreateHoldingRequest = {
      assetType: 'PRECIOUS_METAL',
      management: 'Safe',
      metal: 'XAU',
      quantity: '1',
      unit: 'OZT',
    };
    expect(service.create(metal, owner).kind).toBe('created');
    expect(service.create({ ...metal, quantity: '2' }, owner).kind).toBe('updated');
    expect(service.create({ ...metal, metal: 'XAG' }, owner).kind).toBe('created');

    const deposit: CreateHoldingRequest = {
      assetType: 'DEPOSIT_MONEY',
      management: 'N26',
      name: 'Tagesgeld',
      currentValue: '100',
    };
    expect(service.create(deposit, owner).kind).toBe('created');
    expect(service.create({ ...deposit, name: '  tagesgeld ' }, owner).kind).toBe('updated');

    const share: CreateHoldingRequest = { ...etf, assetType: 'SHARE' };
    expect(service.create(share, owner).kind).toBe('created');
    expect(service.create(share, owner).kind).toBe('created');
  });

  it('does not merge across owners', () => {
    service.create(etf, owner);
    expect(service.create(etf, 'owner-2').kind).toBe('created');
    expect(service.findAll(owner)).toHaveLength(1);
  });

  it('rejects a field that does not apply to the asset type', () => {
    const result = service.create(
      { ...etf, metal: 'XAU' } as unknown as CreateHoldingRequest,
      owner,
    );
    expect(result).toEqual({
      kind: 'invalid',
      fieldErrors: [{ field: 'metal', code: 'FIELD_NOT_ALLOWED' }],
    });
    expect(service.findAll(owner)).toEqual([]);
  });

  it('update keeps the asset type, hides foreign rows and rejects an assetType change', () => {
    const created = service.create(etf, owner);
    if (created.kind !== 'created') throw new Error('not created');
    const { assetType: _t, ...body } = etf;
    expect(service.update(created.holding.id, { ...body, quantity: '3' }, owner).kind).toBe(
      'updated',
    );
    expect(service.findAll(owner)[0].quantity?.toString()).toBe('3');
    expect(service.update(created.holding.id, body, 'owner-2')).toEqual({ kind: 'not_found' });
    expect(
      service.update(created.holding.id, { ...body, assetType: 'SHARE' } as never, owner),
    ).toEqual({
      kind: 'invalid',
      fieldErrors: [{ field: 'assetType', code: 'FIELD_NOT_ALLOWED' }],
    });
  });

  it('deletes only the caller own row', () => {
    const created = service.create(etf, owner);
    if (created.kind !== 'created') throw new Error('not created');
    expect(service.delete(created.holding.id, 'owner-2')).toBe(false);
    expect(service.delete(created.holding.id, owner)).toBe(true);
    expect(service.delete(created.holding.id, owner)).toBe(false);
  });

  it('skips one corrupt row without locking the domain; fails closed when all are corrupt', () => {
    service.create(etf, owner);
    service.create({ ...etf, isin: 'US0378331005' }, owner);
    const [first] = database.querySync<{ id: string }>('SELECT id FROM holdings ORDER BY id');
    database.querySync("UPDATE holdings SET payload_enc = 'v1:AAAA:AAAA:AAAA' WHERE id = $1", [
      first.id,
    ]);
    expect(service.findAll(owner)).toHaveLength(1);
    expect(crypto.available).toBe(true);

    database.querySync("UPDATE holdings SET payload_enc = 'v1:AAAA:AAAA:AAAA'");
    expect(() => service.findAll(owner)).toThrow(HoldingsUnavailableException);
    expect(crypto.available).toBe(true);
  });
});
