import { ACCOUNT_CATEGORIES, isAccountCategory } from './account-category.js';

describe('isAccountCategory', () => {
  it('returns true for every known category', () => {
    for (const category of ACCOUNT_CATEGORIES) {
      expect(isAccountCategory(category)).toBe(true);
    }
  });

  it('returns false for an unrecognized string', () => {
    expect(isAccountCategory('UNKNOWN')).toBe(false);
  });

  it('returns false for non-string values', () => {
    expect(isAccountCategory(undefined)).toBe(false);
    expect(isAccountCategory(null)).toBe(false);
    expect(isAccountCategory(42)).toBe(false);
  });
});
