/**
 * The fixed set of categories an account can be grouped under, per spec.md's
 * "Category" concept and data-model.md's `AccountCategory` section. A plain
 * string union (not a runtime enum), mirroring `libs/domain/holdings`'s
 * `AssetType`, so both `apps/backend` and `apps/frontend` can share the exact
 * same literals via `libs/api-contract` without a vendor-specific runtime
 * dependency.
 */
export type AccountCategory = 'GENERAL' | 'LEISURE' | 'SAVINGS' | 'CREDIT_CARD' | 'OTHER';

/** Fixed display/grouping order (design.md): General -> Leisure -> Savings -> Credit Card -> Other. */
export const ACCOUNT_CATEGORIES: readonly AccountCategory[] = [
  'GENERAL',
  'LEISURE',
  'SAVINGS',
  'CREDIT_CARD',
  'OTHER',
];

export function isAccountCategory(value: unknown): value is AccountCategory {
  return typeof value === 'string' && (ACCOUNT_CATEGORIES as readonly string[]).includes(value);
}
