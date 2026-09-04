import Decimal from 'decimal.js';
import { Holding } from './holding.js';
import { decideMerge } from './holding-merge.js';
import type { ValidatedHolding } from './holding-validation.js';

/**
 * Exercises data-model.md's merge/upsert rule (FR-011/FR-011a): ETF upsert by
 * `(isin, management)`, Precious metal upsert by `(name, management)`,
 * Share/Crypto always a new lot, and a different Management value always
 * creating a separate row. Written first per Principle III — confirmed
 * failing (no `holding-merge.ts` implementation yet) before T009.
 */

function makeExisting(overrides: Partial<Holding & { id: string }>): Holding {
  const now = new Date('2026-08-01T09:00:00.000Z');
  return new Holding({
    id: overrides.id ?? 'existing-id',
    assetType: overrides.assetType ?? 'ETF',
    management: overrides.management ?? 'Roboadvisor',
    quantity: overrides.quantity ?? new Decimal('10'),
    purchasePrice: overrides.purchasePrice ?? new Decimal('50'),
    purchaseDate: overrides.purchaseDate ?? null,
    isin: overrides.isin ?? 'IE00B4L5Y983',
    name: overrides.name ?? 'iShares Core MSCI World',
    weightGrams: overrides.weightGrams ?? null,
    currentValue: overrides.currentValue ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  });
}

function submission(overrides: Partial<ValidatedHolding>): ValidatedHolding {
  return {
    assetType: 'ETF',
    management: 'Roboadvisor',
    quantity: new Decimal('20'),
    purchasePrice: new Decimal('55'),
    purchaseDate: null,
    isin: 'IE00B4L5Y983',
    name: 'iShares Core MSCI World',
    weightGrams: null,
    currentValue: null,
    ...overrides,
  };
}

describe('decideMerge — ETF', () => {
  it('updates the existing row when isin+management match', () => {
    const existing = makeExisting({});
    const decision = decideMerge(submission({}), [existing]);
    expect(decision).toEqual({ kind: 'update', existingId: 'existing-id' });
  });

  it('creates a new row when no existing ETF matches the isin+management', () => {
    const existing = makeExisting({ isin: 'US0378331005' });
    const decision = decideMerge(submission({}), [existing]);
    expect(decision).toEqual({ kind: 'create' });
  });

  it('creates a separate row for the same isin under a different management', () => {
    const existing = makeExisting({ management: 'Private' });
    const decision = decideMerge(submission({ management: 'Roboadvisor' }), [existing]);
    expect(decision).toEqual({ kind: 'create' });
  });
});

describe('decideMerge — Precious metal', () => {
  it('updates the existing row when name+management match (Gold vs. Gold)', () => {
    const existing = makeExisting({
      assetType: 'PRECIOUS_METAL',
      management: 'Private',
      isin: null,
      name: 'Gold',
      quantity: null,
      purchasePrice: null,
      weightGrams: new Decimal('10'),
    });
    const decision = decideMerge(
      submission({
        assetType: 'PRECIOUS_METAL',
        management: 'Private',
        isin: null,
        name: 'Gold',
        quantity: null,
        purchasePrice: null,
        weightGrams: new Decimal('31.1'),
      }),
      [existing],
    );
    expect(decision).toEqual({ kind: 'update', existingId: 'existing-id' });
  });

  it('does not match when name differs under the same management (Gold vs. Silver)', () => {
    const existing = makeExisting({
      assetType: 'PRECIOUS_METAL',
      management: 'Private',
      isin: null,
      name: 'Gold',
      quantity: null,
      purchasePrice: null,
      weightGrams: new Decimal('10'),
    });
    const decision = decideMerge(
      submission({
        assetType: 'PRECIOUS_METAL',
        management: 'Private',
        isin: null,
        name: 'Silver',
        quantity: null,
        purchasePrice: null,
        weightGrams: new Decimal('500'),
      }),
      [existing],
    );
    expect(decision).toEqual({ kind: 'create' });
  });

  it('creates a separate Precious metal row for a different management', () => {
    const existing = makeExisting({
      assetType: 'PRECIOUS_METAL',
      management: 'Private',
      isin: null,
      name: 'Gold',
      quantity: null,
      purchasePrice: null,
      weightGrams: new Decimal('10'),
    });
    const decision = decideMerge(
      submission({
        assetType: 'PRECIOUS_METAL',
        management: 'Bank',
        isin: null,
        name: 'Gold',
        quantity: null,
        purchasePrice: null,
        weightGrams: new Decimal('5'),
      }),
      [existing],
    );
    expect(decision).toEqual({ kind: 'create' });
  });
});

describe('decideMerge — Share/Crypto', () => {
  it('always creates a new row for Share, even with an identical isin+management match', () => {
    const existing = makeExisting({ assetType: 'SHARE', management: 'Private' });
    const decision = decideMerge(submission({ assetType: 'SHARE', management: 'Private' }), [
      existing,
    ]);
    expect(decision).toEqual({ kind: 'create' });
  });

  it('always creates a new row for Crypto, even under the same management and name', () => {
    const existing = makeExisting({
      assetType: 'CRYPTO',
      management: 'Private',
      isin: null,
      name: 'Bitcoin',
      quantity: new Decimal('0.1'),
      purchasePrice: new Decimal('40000'),
    });
    const decision = decideMerge(
      submission({
        assetType: 'CRYPTO',
        management: 'Private',
        isin: null,
        name: 'Bitcoin',
        quantity: new Decimal('0.2'),
        purchasePrice: new Decimal('45000'),
      }),
      [existing],
    );
    expect(decision).toEqual({ kind: 'create' });
  });
});
