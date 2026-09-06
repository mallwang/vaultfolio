import { deriveCardBrand } from './card-brand.js';

describe('deriveCardBrand', () => {
  it('returns null for a missing/empty card number', () => {
    expect(deriveCardBrand(null)).toBeNull();
    expect(deriveCardBrand(undefined)).toBeNull();
    expect(deriveCardBrand('')).toBeNull();
  });

  it('detects Visa (leading 4)', () => {
    expect(deriveCardBrand('4111 1111 1111 1111')).toBe('VISA');
  });

  it('detects Mastercard (51-55 and 2221-2720 ranges)', () => {
    expect(deriveCardBrand('5105105105105100')).toBe('MASTERCARD');
    expect(deriveCardBrand('2221000000000009')).toBe('MASTERCARD');
    expect(deriveCardBrand('2720999999999996')).toBe('MASTERCARD');
  });

  it('detects American Express (34/37)', () => {
    expect(deriveCardBrand('340000000000009')).toBe('AMEX');
    expect(deriveCardBrand('370000000000002')).toBe('AMEX');
  });

  it('ignores spaces/dashes when matching', () => {
    expect(deriveCardBrand('4111-1111-1111-1111')).toBe('VISA');
  });

  it('returns null for an unrecognized range', () => {
    expect(deriveCardBrand('6011000000000004')).toBeNull();
  });
});
