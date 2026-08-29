/**
 * Last-admin invariant (FR-004, research.md #3): a single shared predicate
 * used by all three enforcement points — role change to MEMBER, archive, and
 * self-delete. `activeAdminCount` is the count of currently-`ACTIVE` `ADMIN`
 * accounts, and `isTargetActiveAdmin` tells the predicate whether the
 * account the caller is about to act on is itself one of those active
 * admins (a no-op action, e.g. changing a MEMBER's role, never trips this
 * check regardless of `activeAdminCount`). Pure domain logic, no clock/DB
 * access (Principle I) — the caller (`AccountsService`) is responsible for
 * counting active admins and identifying the target.
 */
export function canRemoveLastAdmin(
  activeAdminCount: number,
  isTargetActiveAdmin: boolean,
): boolean {
  if (!isTargetActiveAdmin) {
    return true;
  }
  return activeAdminCount > 1;
}
