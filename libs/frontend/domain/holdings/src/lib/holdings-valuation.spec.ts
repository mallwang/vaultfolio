import Decimal from 'decimal.js';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { computeHoldingValue, groupHoldingsByKey } from './holdings-valuation';

function holding(overrides: Partial<HoldingResponse>): HoldingResponse {
  return {
    id: 'id',
    assetType: 'SHARE',
    management: 'Broker',
    quantity: null,
    purchasePrice: null,
    purchaseDate: null,
    isin: null,
    name: null,
    weightGrams: null,
    currentValue: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeHoldingValue', () => {
  it('computes PRECIOUS_METAL value from currentValue', () => {
    const value = computeHoldingValue(holding({ assetType: 'PRECIOUS_METAL', currentValue: '25' }));
    expect(value?.toString()).toBe('25');
  });

  it('returns null for PRECIOUS_METAL with no currentValue', () => {
    expect(
      computeHoldingValue(holding({ assetType: 'PRECIOUS_METAL', currentValue: null })),
    ).toBeNull();
  });

  it('computes DEPOSIT_MONEY value from currentValue', () => {
    const value = computeHoldingValue(
      holding({ assetType: 'DEPOSIT_MONEY', currentValue: '1750' }),
    );
    expect(value?.toString()).toBe('1750');
  });

  it('returns null for DEPOSIT_MONEY with no currentValue', () => {
    expect(
      computeHoldingValue(holding({ assetType: 'DEPOSIT_MONEY', currentValue: null })),
    ).toBeNull();
  });

  it('computes ETF value from quantity times purchasePrice', () => {
    const value = computeHoldingValue(
      holding({ assetType: 'ETF', quantity: '3', purchasePrice: '10.5' }),
    );
    expect(value?.toString()).toBe('31.5');
  });

  it('computes SHARE value from quantity times purchasePrice', () => {
    const value = computeHoldingValue(
      holding({ assetType: 'SHARE', quantity: '10', purchasePrice: '5' }),
    );
    expect(value?.toString()).toBe('50');
  });

  it('computes CRYPTO value from quantity times purchasePrice', () => {
    const value = computeHoldingValue(
      holding({ assetType: 'CRYPTO', quantity: '0.1', purchasePrice: '40000' }),
    );
    expect(value?.toString()).toBe('4000');
  });

  it('returns null for ETF/SHARE/CRYPTO with missing quantity', () => {
    expect(
      computeHoldingValue(holding({ assetType: 'ETF', quantity: null, purchasePrice: '10' })),
    ).toBeNull();
  });

  it('returns null for ETF/SHARE/CRYPTO with missing purchasePrice', () => {
    expect(
      computeHoldingValue(holding({ assetType: 'SHARE', quantity: '1', purchasePrice: null })),
    ).toBeNull();
  });
});

describe('groupHoldingsByKey', () => {
  it('sums two holdings sharing the same key into one entry', () => {
    const result = groupHoldingsByKey(
      [
        holding({ id: '1', assetType: 'PRECIOUS_METAL', name: 'Gold', currentValue: '25' }),
        holding({ id: '2', assetType: 'PRECIOUS_METAL', name: 'Gold', currentValue: '17.5' }),
      ],
      (h) => h.name,
    );

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].key).toBe('Gold');
    expect(result.entries[0].value.toString()).toBe('42.5');
    expect(result.excludedCount).toBe(0);
  });

  it('excludes a holding with no computable value, incrementing excludedCount without adding an entry', () => {
    const result = groupHoldingsByKey(
      [
        holding({ id: '1', assetType: 'SHARE', name: 'Apple', quantity: '10', purchasePrice: '5' }),
        holding({
          id: '2',
          assetType: 'ETF',
          name: 'Vanguard',
          quantity: null,
          purchasePrice: null,
        }),
      ],
      (h) => h.name,
    );

    expect(result.entries).toEqual([{ key: 'Apple', value: new Decimal(50) }]);
    expect(result.excludedCount).toBe(1);
  });

  it('excludes a holding whose keyOf returns null, without adding an entry', () => {
    const result = groupHoldingsByKey(
      [
        holding({ id: '1', assetType: 'SHARE', name: null, quantity: '10', purchasePrice: '5' }),
        holding({ id: '2', assetType: 'SHARE', name: 'Apple', quantity: '1', purchasePrice: '2' }),
      ],
      (h) => h.name,
    );

    expect(result.entries).toEqual([{ key: 'Apple', value: new Decimal(2) }]);
    expect(result.excludedCount).toBe(1);
  });

  it('returns an empty entries array with the correct excludedCount when nothing is computable', () => {
    const result = groupHoldingsByKey(
      [
        holding({
          id: '1',
          assetType: 'ETF',
          name: 'Vanguard',
          quantity: null,
          purchasePrice: null,
        }),
        holding({ id: '2', assetType: 'ETF', name: 'iShares', quantity: '1', purchasePrice: null }),
      ],
      (h) => h.name,
    );

    expect(result.entries).toEqual([]);
    expect(result.excludedCount).toBe(2);
  });

  it('preserves first-seen key order', () => {
    const result = groupHoldingsByKey(
      [
        holding({ id: '1', assetType: 'SHARE', name: 'Zeta', quantity: '1', purchasePrice: '1' }),
        holding({ id: '2', assetType: 'SHARE', name: 'Alpha', quantity: '1', purchasePrice: '1' }),
        holding({ id: '3', assetType: 'SHARE', name: 'Zeta', quantity: '1', purchasePrice: '1' }),
      ],
      (h) => h.name,
    );

    expect(result.entries.map((entry) => entry.key)).toEqual(['Zeta', 'Alpha']);
  });
});
