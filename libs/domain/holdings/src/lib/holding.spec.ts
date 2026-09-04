import Decimal from 'decimal.js';
import { Holding } from './holding.js';
import type { HoldingProps } from './holding.js';

/**
 * Exercises `Holding.computeValue()` per data-model.md — DEPOSIT_MONEY and
 * PRECIOUS_METAL return `currentValue` directly, other types compute
 * `quantity × purchasePrice`.
 */

const baseProps: HoldingProps = {
  id: 'h1',
  assetType: 'DEPOSIT_MONEY',
  management: 'N26',
  quantity: null,
  purchasePrice: null,
  purchaseDate: null,
  isin: null,
  name: 'N26 checking',
  weightGrams: null,
  currentValue: new Decimal('1250.00'),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('Holding.computeValue', () => {
  it('returns currentValue directly for DEPOSIT_MONEY', () => {
    const holding = new Holding(baseProps);
    expect(holding.computeValue()?.equals(new Decimal('1250.00'))).toBe(true);
  });

  it('returns currentValue directly for PRECIOUS_METAL', () => {
    const holding = new Holding({
      ...baseProps,
      assetType: 'PRECIOUS_METAL',
      weightGrams: new Decimal('31.1'),
    });
    expect(holding.computeValue()?.equals(new Decimal('1250.00'))).toBe(true);
  });

  it('returns quantity × purchasePrice for SHARE/CRYPTO/ETF', () => {
    const holding = new Holding({
      ...baseProps,
      assetType: 'SHARE',
      currentValue: null,
      quantity: new Decimal('10'),
      purchasePrice: new Decimal('150'),
    });
    expect(holding.computeValue()?.equals(new Decimal('1500'))).toBe(true);
  });
});
