import { GRAMS_PER_TROY_OUNCE, toGrams } from './units.js';

describe('toGrams', () => {
  it('converts troy ounces exactly', () => {
    expect(GRAMS_PER_TROY_OUNCE).toBe('31.1035');
    expect(toGrams('2', 'OZT')).toBe('62.207');
  });

  it('keeps grams unchanged', () => {
    expect(toGrams('1.5', 'G')).toBe('1.5');
  });

  it('has no float artefacts for 8-decimal ounces', () => {
    expect(toGrams('0.12345678', 'OZT')).toBe('3.83993795673');
    expect(toGrams('0.00000001', 'OZT')).toBe('0.000000311035');
  });
});
