import type { HoldingResponse } from '@vaultfolio/api-contract';
import { holdingAssetName } from './holding-display';

const t = (key: string) => ({ 'holdingMetal.XAU': 'Gold' })[key] ?? key;
const h = (o: Partial<HoldingResponse>) => o as HoldingResponse;

describe('holdingAssetName', () => {
  it('shows the translated metal name', () => {
    expect(holdingAssetName(h({ assetType: 'PRECIOUS_METAL', metal: 'XAU' }), t)).toBe('Gold');
  });
  it('shows coin name and symbol', () => {
    expect(holdingAssetName(h({ assetType: 'CRYPTO', coinId: 'bitcoin' }), t)).toBe(
      'Bitcoin (BTC)',
    );
  });
  it('falls back to the raw code for a stale metal or coin', () => {
    expect(holdingAssetName(h({ assetType: 'PRECIOUS_METAL', metal: 'XXX' as never }), t)).toBe(
      'XXX',
    );
    expect(holdingAssetName(h({ assetType: 'CRYPTO', coinId: 'gone-coin' }), t)).toBe('gone-coin');
  });
  it('shows the name for ETF, SHARE and deposit money', () => {
    expect(holdingAssetName(h({ assetType: 'ETF', name: 'MSCI World' }), t)).toBe('MSCI World');
    expect(holdingAssetName(h({ assetType: 'DEPOSIT_MONEY', name: 'Savings' }), t)).toBe('Savings');
  });
});
