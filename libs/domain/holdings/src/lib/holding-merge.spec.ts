import Decimal from 'decimal.js';
import { Holding } from './holding.js';
import type { HoldingProps } from './holding.js';
import { decideMerge, findMergeKey } from './holding-merge.js';
import type { ValidatedHolding } from './holding-validation.js';

const now = new Date('2026-08-01T09:00:00.000Z');

function existing(overrides: Partial<HoldingProps>): Holding {
  return new Holding({
    id: 'existing-id',
    assetType: 'ETF',
    management: 'Roboadvisor',
    note: null,
    isin: 'IE00B4L5Y983',
    name: 'iShares Core MSCI World',
    metal: null,
    coinId: null,
    quantity: new Decimal('10'),
    unit: null,
    purchasePrice: new Decimal('50'),
    currentValue: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function submission(overrides: Partial<ValidatedHolding>): ValidatedHolding {
  return {
    assetType: 'ETF',
    management: 'Roboadvisor',
    note: null,
    isin: 'IE00B4L5Y983',
    name: 'iShares Core MSCI World',
    metal: null,
    unit: null,
    coinId: null,
    quantity: new Decimal('20'),
    purchasePrice: new Decimal('55'),
    currentValue: null,
    ...overrides,
  };
}

const gold = {
  assetType: 'PRECIOUS_METAL' as const,
  isin: null,
  name: null,
  metal: 'XAU' as const,
};
const deposit = {
  assetType: 'DEPOSIT_MONEY' as const,
  isin: null,
  name: 'N26 checking',
  management: 'N26',
};

describe('findMergeKey', () => {
  it('has a key for ETF, metal and deposit', () => {
    expect(findMergeKey(submission({}))).toBe('["ETF","IE00B4L5Y983","Roboadvisor"]');
    expect(findMergeKey(submission({ ...gold, management: 'Private' }))).toBe(
      '["PRECIOUS_METAL","XAU","Private"]',
    );
    expect(findMergeKey(submission(deposit))).toBe('["DEPOSIT_MONEY","n26 checking","N26"]');
  });

  it('normalises the deposit name (case and whitespace)', () => {
    expect(findMergeKey(submission({ ...deposit, name: '  N26   Checking ' }))).toBe(
      findMergeKey(submission(deposit)),
    );
  });

  it('has no key for SHARE and CRYPTO', () => {
    expect(findMergeKey(submission({ assetType: 'SHARE' }))).toBeNull();
    expect(
      findMergeKey(submission({ assetType: 'CRYPTO', isin: null, coinId: 'bitcoin' })),
    ).toBeNull();
  });
});

describe('decideMerge', () => {
  it('updates an ETF with the same isin+management', () => {
    expect(decideMerge(submission({}), [existing({})])).toEqual({
      kind: 'update',
      existingId: 'existing-id',
    });
  });

  it('creates for a different isin or a different management', () => {
    expect(decideMerge(submission({}), [existing({ isin: 'US0378331005' })])).toEqual({
      kind: 'create',
    });
    expect(decideMerge(submission({}), [existing({ management: 'Private' })])).toEqual({
      kind: 'create',
    });
  });

  it('updates a metal with the same metal+management, creates for another metal', () => {
    const row = existing({ ...gold, management: 'Private', quantity: new Decimal('1'), unit: 'G' });
    expect(decideMerge(submission({ ...gold, management: 'Private' }), [row])).toEqual({
      kind: 'update',
      existingId: 'existing-id',
    });
    expect(
      decideMerge(submission({ ...gold, metal: 'XAG', management: 'Private' }), [row]),
    ).toEqual({
      kind: 'create',
    });
  });

  it('updates a deposit with the same normalised name+management', () => {
    const row = existing({ ...deposit, quantity: null, currentValue: new Decimal('5') });
    expect(decideMerge(submission({ ...deposit, name: 'n26 CHECKING' }), [row])).toEqual({
      kind: 'update',
      existingId: 'existing-id',
    });
  });

  it('never merges shares', () => {
    const row = existing({ assetType: 'SHARE', isin: 'US0378331005' });
    expect(decideMerge(submission({ assetType: 'SHARE', isin: 'US0378331005' }), [row])).toEqual({
      kind: 'create',
    });
  });

  it('keeps the same coin at the same broker as two entries', () => {
    const row = existing({
      assetType: 'CRYPTO',
      isin: null,
      name: null,
      coinId: 'bitcoin',
      management: 'Kraken',
    });
    expect(
      decideMerge(
        submission({
          assetType: 'CRYPTO',
          isin: null,
          name: null,
          coinId: 'bitcoin',
          management: 'Kraken',
        }),
        [row],
      ),
    ).toEqual({ kind: 'create' });
  });
});
