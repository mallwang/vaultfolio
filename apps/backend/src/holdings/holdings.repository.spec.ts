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
  const ownerId = 'test-owner-id';

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-holdings-repo-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'a-valid-8-char-password';

    database = new DatabaseService();
    await database.onModuleInit();
    await database.query(
      `INSERT INTO users (id, email, display_name, password_hash, role) VALUES ($1, 'owner@example.com', 'Owner', 'x', 'MEMBER')`,
      [ownerId],
    );
    repository = new HoldingsRepository(database);
  });

  afterAll(async () => {
    await database.onModuleDestroy();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
  });

  const baseHolding: Omit<
    ValidatedHolding,
    'quantity' | 'purchasePrice' | 'weightGrams' | 'currentValue'
  > = {
    assetType: 'PRECIOUS_METAL',
    management: 'Home safe',
    purchaseDate: null,
    isin: null,
    name: 'Gold',
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

    const inserted = await repository.insert(value, ownerId);
    expect(inserted.weightGrams?.toString()).toBe(weightGrams);
    expect(inserted.currentValue?.toString()).toBe(currentValue);

    const reloaded = await repository.findById(inserted.id, ownerId);
    expect(reloaded?.weightGrams?.toString()).toBe(weightGrams);
    expect(reloaded?.currentValue?.toString()).toBe(currentValue);
  });

  it('round-trips quantity and purchasePrice with 8 decimal places byte-for-byte (Crypto)', async () => {
    const quantity = '0.12345678';
    const purchasePrice = '42000.87654321';

    const value: ValidatedHolding = {
      assetType: 'CRYPTO',
      management: 'Private',
      purchaseDate: null,
      isin: null,
      name: 'Bitcoin',
      quantity: new Decimal(quantity),
      purchasePrice: new Decimal(purchasePrice),
      weightGrams: null,
      currentValue: null,
    };

    const inserted = await repository.insert(value, ownerId);
    expect(inserted.quantity?.toString()).toBe(quantity);
    expect(inserted.purchasePrice?.toString()).toBe(purchasePrice);

    const reloaded = await repository.findById(inserted.id, ownerId);
    expect(reloaded?.quantity?.toString()).toBe(quantity);
    expect(reloaded?.purchasePrice?.toString()).toBe(purchasePrice);
  });
});

/**
 * Precious metal upsert-lookup tests (research.md #2, FR-005): the
 * `(assetType, name, management)` branch `findUpsertMatch()` gained when
 * `PRECIOUS_METAL` replaced `GOLD`'s `(management)`-alone lookup.
 */
describe('HoldingsRepository — findUpsertMatch (Precious metal)', () => {
  let database: DatabaseService;
  let repository: HoldingsRepository;
  let tempDir: string;
  const ownerId = 'test-owner-id-2';

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-holdings-repo-upsert-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'a-valid-8-char-password';

    database = new DatabaseService();
    await database.onModuleInit();
    await database.query(
      `INSERT INTO users (id, email, display_name, password_hash, role) VALUES ($1, 'owner2@example.com', 'Owner', 'x', 'MEMBER')`,
      [ownerId],
    );
    repository = new HoldingsRepository(database);
  });

  afterAll(async () => {
    await database.onModuleDestroy();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
  });

  it('matches an existing Precious metal row on (name, management)', async () => {
    const gold: ValidatedHolding = {
      assetType: 'PRECIOUS_METAL',
      management: 'Private',
      purchaseDate: null,
      isin: null,
      name: 'Gold',
      quantity: null,
      purchasePrice: null,
      weightGrams: new Decimal('31.1'),
      currentValue: null,
    };
    const inserted = await repository.insert(gold, ownerId);

    const match = await repository.findUpsertMatch('PRECIOUS_METAL', 'Private', 'Gold', ownerId);
    expect(match?.id).toBe(inserted.id);
  });

  it('does not match a different name under the same management (Gold vs. Silver)', async () => {
    await repository.insert(
      {
        assetType: 'PRECIOUS_METAL',
        management: 'Bank',
        purchaseDate: null,
        isin: null,
        name: 'Gold',
        quantity: null,
        purchasePrice: null,
        weightGrams: new Decimal('10'),
        currentValue: null,
      },
      ownerId,
    );

    const match = await repository.findUpsertMatch('PRECIOUS_METAL', 'Bank', 'Silver', ownerId);
    expect(match).toBeNull();
  });
});
