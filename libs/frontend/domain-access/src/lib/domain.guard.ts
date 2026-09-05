import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';
import { CURRENT_USER_SOURCE } from './current-user-source.token.js';
import { isDomainEntitled } from './is-domain-entitled.js';

/**
 * Functional route-guard factory (contracts/domain-access.md), modeled on
 * `adminGuard`: redirects to `/app/dashboard` the same way `adminGuard` does
 * today when the current user isn't entitled to `domainId` (FR-005).
 */
export function domainGuard(domainId: string): CanActivateFn {
  return () => {
    const currentUserSource = inject(CURRENT_USER_SOURCE);
    const router = inject(Router);

    return isDomainEntitled(currentUserSource.current(), domainId)
      ? true
      : router.parseUrl('/app/dashboard');
  };
}
