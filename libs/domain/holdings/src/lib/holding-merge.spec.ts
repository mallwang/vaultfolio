import Decimal from 'decimal.js';
import { Holding } from './holding.js';
import { decideMerge } from './holding-merge.js';
import type { ValidatedHolding } from './holding-validation.js';

/**
 * Exercises data-model.md's merge/upsert rule (FR-011/FR-011a): ETF upsert by
 * `(isin, management)`, Gold upsert by `(management)`, Share/Bitcoin always a
 * new lot, and a different Management value always creating a separate row.
 * Written first per Principle III — confirmed failing (no `holding-merge.ts`
 * implementation yet) before T009.
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

describe('decideMerge — Gold', () => {
  it('updates the existing row when management matches (no isin identifier)', () => {
    const existing = makeExisting({
      assetType: 'GOLD',
      management: 'Private',
      isin: null,
      name: null,
      quantity: null,
      purchasePrice: null,
      weightGrams: new Decimal('10'),
    });
    const decision = decideMerge(
      submission({
        assetType: 'GOLD',
        management: 'Private',
        isin: null,
        name: null,
        quantity: null,
        purchasePrice: null,
        weightGrams: new Decimal('31.1'),
      }),
      [existing],
    );
    expect(decision).toEqual({ kind: 'update', existingId: 'existing-id' });
  });

  it('creates a separate Gold row for a different management', () => {
    const existing = makeExisting({
      assetType: 'GOLD',
      management: 'Private',
      isin: null,
      name: null,
      quantity: null,
      purchasePrice: null,
      weightGrams: new Decimal('10'),
    });
    const decision = decideMerge(
      submission({
        assetType: 'GOLD',
        management: 'Bank',
        isin: null,
        name: null,
        quantity: null,
        purchasePrice: null,
        weightGrams: new Decimal('5'),
      }),
      [existing],
    );
    expect(decision).toEqual({ kind: 'create' });
  });
});

describe('decideMerge — Share/Bitcoin', () => {
  it('always creates a new row for Share, even with an identical isin+management match', () => {
    const existing = makeExisting({ assetType: 'SHARE', management: 'Private' });
    const decision = decideMerge(submission({ assetType: 'SHARE', management: 'Private' }), [
      existing,
    ]);
    expect(decision).toEqual({ kind: 'create' });
  });

  it('always creates a new row for Bitcoin, even under the same management', () => {
    const existing = makeExisting({
      assetType: 'BITCOIN',
      management: 'Private',
      isin: null,
      name: null,
      quantity: new Decimal('0.1'),
      purchasePrice: new Decimal('40000'),
    });
    const decision = decideMerge(
      submission({
        assetType: 'BITCOIN',
        management: 'Private',
        isin: null,
        name: null,
        quantity: new Decimal('0.2'),
        purchasePrice: new Decimal('45000'),
      }),
      [existing],
    );
    expect(decision).toEqual({ kind: 'create' });
  });
});
