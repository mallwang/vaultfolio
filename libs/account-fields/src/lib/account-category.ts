/**
 * The fixed set of categories an account can be grouped under, per spec.md's
 * "Category" concept and data-model.md's `AccountCategory` section. A plain
 * string union (not a runtime enum), mirroring `libs/domain/holdings`'s
 * `AssetType`.
 *
 * Lives in this `scope:shared` `account-fields` lib (rather than
 * `libs/domain/accounts`) so `libs/frontend/domain/account-overview` (tag
 * `scope:frontend-domain`) can depend on it too, per the module-boundary
 * rules in `eslint.config.mjs` — see `card-brand.ts` for the same reasoning.
 * Every consumer (`domain-accounts`, `apps/backend`,
 * `frontend/domain/account-overview`) imports directly from
 * `@vaultfolio/account-fields` rather than through a re-export.
 * `libs/api-contract`'s `AccountCategory` is a separate, independently
 * defined wire type by design (mirroring holdings' `AssetType` there too),
 * not this one.
 */
export type AccountCategory = 'GENERAL' | 'LEISURE' | 'SAVINGS' | 'DEPOT' | 'CREDIT_CARD' | 'OTHER';

/** Fixed display/grouping order (design.md): General -> Leisure -> Savings -> Depot -> Credit Card -> Other. */
export const ACCOUNT_CATEGORIES: readonly AccountCategory[] = [
  'GENERAL',
  'LEISURE',
  'SAVINGS',
  'DEPOT',
  'CREDIT_CARD',
  'OTHER',
];

export function isAccountCategory(value: unknown): value is AccountCategory {
  return typeof value === 'string' && (ACCOUNT_CATEGORIES as readonly string[]).includes(value);
}
