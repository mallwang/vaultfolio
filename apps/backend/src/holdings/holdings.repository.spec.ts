import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import Decimal from 'decimal.js';
import type { ValidatedHolding } from '@vaultfolio/domain-holdings';
import { DatabaseService } from '../database/database.service';
import { HoldingsRepository } from './holdings.repository';

/**
 * Exact-decimal round-trip tests (Principle III obligation, plan.md
 * Constitution Check) for the SQLite `TEXT`-column storage of
 * `quantity`/`purchasePrice`/`weightGrams`/`currentValue` — asserts
 * byte-for-byte string equality, not just numeric equality, per FR-005/
 * SC-005 and research.md #3.
 */
describe('HoldingsRepository — exact-decimal round-trip (SQLite TEXT storage)', () => {
  let database: DatabaseService;
  let repository: HoldingsRepository;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-holdings-repo-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');

    database = new DatabaseService();
    await database.onModuleInit();
    repository = new HoldingsRepository(database);
  });

  afterAll(async () => {
    await database.onModuleDestroy();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  });

  const baseHolding: Omit<
    ValidatedHolding,
    'quantity' | 'purchasePrice' | 'weightGrams' | 'currentValue'
  > = {
    assetType: 'GOLD',
    management: 'Home safe',
    purchaseDate: null,
    isin: null,
    name: null,
  };

  it('round-trips weightGrams and currentValue with 8 decimal places byte-for-byte', async () => {
    // No trailing zeros: decimal.js's own `.toString()` normalization (applied by
    // `validatedHoldingToRow` before every persist, identically under the previous
    // `pg`-backed implementation) already strips those regardless of storage engine —
    // that's not something this migration changes, so it's kept out of this assertion.
    const weightGrams = '12.34567891';
    const currentValue = '987654.32109999';

    const value: ValidatedHolding = {
      ...baseHolding,
      quantity: null,
      purchasePrice: null,
      weightGrams: new Decimal(weightGrams),
      currentValue: new Decimal(currentValue),
    };

    const inserted = await repository.insert(value);
    expect(inserted.weightGrams?.toString()).toBe(weightGrams);
    expect(inserted.currentValue?.toString()).toBe(currentValue);

    const reloaded = await repository.findById(inserted.id);
    expect(reloaded?.weightGrams?.toString()).toBe(weightGrams);
    expect(reloaded?.currentValue?.toString()).toBe(currentValue);
  });

  it('round-trips quantity and purchasePrice with 8 decimal places byte-for-byte (Bitcoin)', async () => {
    const quantity = '0.12345678';
    const purchasePrice = '42000.87654321';

    const value: ValidatedHolding = {
      assetType: 'BITCOIN',
      management: 'Private',
      purchaseDate: null,
      isin: null,
      name: null,
      quantity: new Decimal(quantity),
      purchasePrice: new Decimal(purchasePrice),
      weightGrams: null,
      currentValue: null,
    };

    const inserted = await repository.insert(value);
    expect(inserted.quantity?.toString()).toBe(quantity);
    expect(inserted.purchasePrice?.toString()).toBe(purchasePrice);

    const reloaded = await repository.findById(inserted.id);
    expect(reloaded?.quantity?.toString()).toBe(quantity);
    expect(reloaded?.purchasePrice?.toString()).toBe(purchasePrice);
  });
});
