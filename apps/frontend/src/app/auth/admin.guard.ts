import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';
import { CurrentUserStore } from './current-user.store';

/**
 * Functional route guard (research.md "Decision: Route-level guard"),
 * modeled on `authGuard`: only ADMIN-role users may activate the guarded
 * route. This is a UX/defense-in-depth measure, not the security
 * boundary — the backend's `RolesGuard`/`@Roles('ADMIN')` already rejects
 * MEMBER requests to admin endpoints regardless of what the frontend
 * renders or guards (Constitution Principle II).
 */
export const adminGuard: CanActivateFn = () => {
  const currentUser = inject(CurrentUserStore);
  const router = inject(Router);

  return currentUser.current()?.role === 'ADMIN' ? true : router.parseUrl('/app/dashboard');
};
