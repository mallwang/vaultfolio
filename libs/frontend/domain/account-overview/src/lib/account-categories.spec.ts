import { countByCategory } from './account-categories';

describe('countByCategory', () => {
  it('returns nothing for no accounts', () => {
    expect(countByCategory([])).toEqual([]);
  });

  it('counts in the fixed category order and omits empty categories', () => {
    const result = countByCategory([
      { category: 'CREDIT_CARD' },
      { category: 'GENERAL' },
      { category: 'CREDIT_CARD' },
      { category: 'OTHER' },
    ]);
    expect(result).toEqual([
      { category: 'GENERAL', count: 1 },
      { category: 'CREDIT_CARD', count: 2 },
      { category: 'OTHER', count: 1 },
    ]);
  });
});
