/**
 * Whether an account is still in active use or has been decommissioned
 * (closed/cancelled but kept in the overview for reference — the whole
 * point of this field: a decommissioned account keeps its history and
 * context instead of disappearing on deletion). Mirrors
 * `account-category.ts`'s plain-string-union shape and reason for living in
 * this `scope:shared` lib.
 */
export type AccountStatus = 'ACTIVE' | 'DECOMMISSIONED';

/** Defaults to `ACTIVE` when omitted, listed in display order (active first). */
export const ACCOUNT_STATUSES: readonly AccountStatus[] = ['ACTIVE', 'DECOMMISSIONED'];

export function isAccountStatus(value: unknown): value is AccountStatus {
  return typeof value === 'string' && (ACCOUNT_STATUSES as readonly string[]).includes(value);
}
