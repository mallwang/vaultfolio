import Decimal from 'decimal.js';
import { Holding } from './holding.js';
import type { HoldingProps } from './holding.js';

const baseProps: HoldingProps = {
  id: 'h1',
  assetType: 'DEPOSIT_MONEY',
  management: 'N26',
  note: null,
  isin: null,
  name: 'N26 checking',
  metal: null,
  coinId: null,
  quantity: null,
  unit: null,
  purchasePrice: null,
  currentValue: new Decimal('1250.00'),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('Holding.computeValue', () => {
  it('returns currentValue for DEPOSIT_MONEY', () => {
    expect(new Holding(baseProps).computeValue()?.toFixed(2)).toBe('1250.00');
  });

  it('returns quantity x purchasePrice for PRECIOUS_METAL', () => {
    const holding = new Holding({
      ...baseProps,
      assetType: 'PRECIOUS_METAL',
      name: null,
      metal: 'XAU',
      quantity: new Decimal('2'),
      unit: 'OZT',
      purchasePrice: new Decimal('625'),
    });
    expect(holding.computeValue()?.toFixed(2)).toBe('1250.00');
  });

  it('returns null for PRECIOUS_METAL without purchasePrice', () => {
    const holding = new Holding({
      ...baseProps,
      assetType: 'PRECIOUS_METAL',
      metal: 'XAG',
      quantity: new Decimal('100'),
      unit: 'G',
      currentValue: null,
    });
    expect(holding.computeValue()).toBeNull();
  });

  it('returns quantity x purchasePrice for SHARE', () => {
    const holding = new Holding({
      ...baseProps,
      assetType: 'SHARE',
      currentValue: null,
      quantity: new Decimal('10'),
      purchasePrice: new Decimal('150'),
    });
    expect(holding.computeValue()?.toFixed()).toBe('1500');
  });

  it('is exact for an 8-decimal crypto quantity', () => {
    const holding = new Holding({
      ...baseProps,
      assetType: 'CRYPTO',
      name: null,
      coinId: 'bitcoin',
      currentValue: null,
      quantity: new Decimal('0.00000001'),
      purchasePrice: new Decimal('42000'),
    });
    expect(holding.computeValue()?.toFixed()).toBe('0.00042');
  });
});
