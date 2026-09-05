import type { SessionUser } from '@vaultfolio/api-contract';

/**
 * The single source of truth for "can this user access this domain"
 * (FR-004, SC-003, data-model.md "Entitlement evaluation"). Both
 * `domainGuard` (route protection) and the sidebar's nav filter call this —
 * neither re-implements the check.
 *
 * - `false` for an unauthenticated user (`user === null`) — the route
 *   guard's `authGuard` already handles this upstream, but this function
 *   stays total.
 * - `true` for `role === 'ADMIN'` regardless of `domainScopes` (FR-008) —
 *   evaluated dynamically, not backfilled into every admin's row, so a
 *   future domain is automatically visible to admins the moment it's
 *   registered in `DOMAIN_REGISTRY`.
 * - Otherwise `true` iff `domainId` is present in `user.domainScopes`.
 */
export function isDomainEntitled(user: SessionUser | null, domainId: string): boolean {
  if (!user) {
    return false;
  }
  if (user.role === 'ADMIN') {
    return true;
  }
  return user.domainScopes.includes(domainId);
}
