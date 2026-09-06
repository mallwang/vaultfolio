import type { AccountCategory } from '@vaultfolio/api-contract';

/**
 * Fixed display/grouping order (design.md): General -> Leisure -> Savings ->
 * Depot -> Credit Card -> Other. Duplicated here — rather than imported —
 * because `apps/frontend` (tag `scope:frontend-domain`) is only permitted to
 * depend on `scope:shared` libraries per the module-boundary rules in
 * `eslint.config.mjs`; `libs/domain/accounts` is `scope:domain`, mirroring
 * `libs/frontend/domain/holdings/src/lib/asset-type-fields.ts`'s identical
 * reasoning. `account-validation.ts` remains the single source of truth for
 * what the server actually accepts.
 */
export const ACCOUNT_CATEGORIES: readonly AccountCategory[] = [
  'GENERAL',
  'LEISURE',
  'SAVINGS',
  'DEPOT',
  'CREDIT_CARD',
  'OTHER',
];
