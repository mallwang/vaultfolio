import { randomBytes } from 'node:crypto';
import type { ValidatedHolding } from '@vaultfolio/domain-holdings';
import { validateHoldingSubmission } from '@vaultfolio/domain-holdings';
import type { DatabaseService } from '../database/database.service';
import { createTestDatabase, createTestKeyring } from '../encryption/encryption.testing';
import { HoldingsCryptoService } from './holdings-crypto.service';
import { HoldingsRepository } from './holdings.repository';

const validated = (management: string): ValidatedHolding => {
  const result = validateHoldingSubmission({
    assetType: 'ETF',
    management,
    isin: 'IE00B4L5Y983',
    name: 'iShares Core MSCI World',
    quantity: '10.5',
    purchasePrice: '75.1234',
  });
  if (!result.valid) throw new Error('fixture invalid');
  return result.value;
};

describe('HoldingsRepository', () => {
  let database: DatabaseService;
  let dispose: () => Promise<void>;
  let repository: HoldingsRepository;

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
    ({ database, dispose } = await createTestDatabase());
    repository = new HoldingsRepository(
      database,
      new HoldingsCryptoService(createTestKeyring(database)),
    );
  });

  afterAll(async () => {
    await dispose();
    delete process.env.ENCRYPTION_KEY;
  });

  beforeEach(() => {
    database.querySync('DELETE FROM holdings');
  });

  it('stores every business field only inside payload_enc', () => {
    repository.insert(validated('Trade Republic'), 'owner-1');
    const [row] = database.querySync<Record<string, unknown>>('SELECT * FROM holdings');
    expect(Object.keys(row).sort()).toEqual(
      ['created_at', 'id', 'key_version', 'owner_id', 'payload_enc', 'updated_at'].sort(),
    );
    for (const secret of ['Trade Republic', 'IE00B4L5Y983', 'iShares', '10.5', '75.1234']) {
      expect(String(row.payload_enc)).not.toContain(secret);
    }
  });

  it('round-trips exact decimals', () => {
    const inserted = repository.insert(validated('Broker'), 'owner-1');
    expect(inserted.quantity?.toString()).toBe('10.5');
    expect(inserted.purchasePrice?.toString()).toBe('75.1234');
    expect(inserted.management).toBe('Broker');
  });

  it("scopes find, update and delete to the owner; another owner's row looks missing", () => {
    const mine = repository.insert(validated('Mine'), 'owner-1');
    repository.insert(validated('Theirs'), 'owner-2');

    expect(repository.findAll('owner-1').map((h) => h.management)).toEqual(['Mine']);
    expect(repository.findById(mine.id, 'owner-2')).toBeNull();
    expect(repository.update(mine.id, validated('Hijacked'), 'owner-2')).toBeNull();
    expect(repository.delete(mine.id, 'owner-2')).toBe(false);
    expect(repository.findById(mine.id, 'owner-1')?.management).toBe('Mine');
    expect(repository.delete(mine.id, 'owner-1')).toBe(true);
    expect(repository.findAll('owner-1')).toEqual([]);
  });

  it('updates in place keeping id and created_at', () => {
    const first = repository.insert(validated('A'), 'owner-1');
    const updated = repository.update(first.id, validated('B'), 'owner-1');
    expect(updated?.id).toBe(first.id);
    expect(updated?.createdAt).toEqual(first.createdAt);
    expect(updated?.management).toBe('B');
  });
});
