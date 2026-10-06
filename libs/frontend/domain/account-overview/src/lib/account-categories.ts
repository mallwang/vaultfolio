import { ACCOUNT_CATEGORIES, type AccountCategory } from '@vaultfolio/account-fields';

export interface CategoryCount {
  category: AccountCategory;
  count: number;
}

/** Accounts per category in the fixed category order, omitting categories without accounts. */
export function countByCategory(
  accounts: readonly { category: AccountCategory }[],
): CategoryCount[] {
  return ACCOUNT_CATEGORIES.map((category) => ({
    category,
    count: accounts.filter((account) => account.category === category).length,
  })).filter((entry) => entry.count > 0);
}
