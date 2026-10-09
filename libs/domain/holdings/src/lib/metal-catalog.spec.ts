import { findMetal, METAL_CATALOG } from './metal-catalog.js';

describe('metal catalogue', () => {
  it('has exactly the four metals', () => {
    expect(METAL_CATALOG).toEqual([
      { code: 'XAU', symbol: 'Au' },
      { code: 'XAG', symbol: 'Ag' },
      { code: 'XPT', symbol: 'Pt' },
      { code: 'XPD', symbol: 'Pd' },
    ]);
  });

  it('finds a metal by code', () => {
    expect(findMetal('XPT')).toEqual({ code: 'XPT', symbol: 'Pt' });
  });

  it('returns undefined for an unknown code', () => {
    expect(findMetal('Gold')).toBeUndefined();
    expect(findMetal('xau')).toBeUndefined();
  });
});
