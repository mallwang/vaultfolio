import { CRYPTO_CATALOG, findCoin } from './crypto-catalog.js';

describe('crypto catalogue', () => {
  it('has unique ids and symbols', () => {
    expect(new Set(CRYPTO_CATALOG.map((c) => c.id)).size).toBe(CRYPTO_CATALOG.length);
    expect(new Set(CRYPTO_CATALOG.map((c) => c.symbol)).size).toBe(CRYPTO_CATALOG.length);
  });

  it('has between 50 and 100 entries', () => {
    expect(CRYPTO_CATALOG.length).toBeGreaterThanOrEqual(50);
    expect(CRYPTO_CATALOG.length).toBeLessThanOrEqual(100);
  });

  it('finds bitcoin exactly', () => {
    expect(findCoin('bitcoin')).toEqual({ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' });
    expect(findCoin('ethereum')).toEqual({ id: 'ethereum', symbol: 'ETH', name: 'Ethereum' });
  });

  it('returns undefined for an unknown id', () => {
    expect(findCoin('not-a-coin')).toBeUndefined();
    expect(findCoin('Bitcoin')).toBeUndefined();
  });
});
