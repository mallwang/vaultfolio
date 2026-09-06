import type { AccountStatus } from '@vaultfolio/api-contract';

/**
 * Display order (active first) — mirrors `account-category-options.ts`'s
 * reasoning for duplicating rather than importing the domain literal.
 */
export const ACCOUNT_STATUSES: readonly AccountStatus[] = ['ACTIVE', 'DECOMMISSIONED'];
