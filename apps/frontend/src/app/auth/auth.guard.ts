import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Functional route guard (research.md #8): calls `GET /api/auth/session` to
 * check auth state before activating a protected route, redirecting to
 * `/sign-in` on failure. The 401 interceptor (`authInterceptor`) handles the
 * same redirect for calls made *after* a route has already activated.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.getSession().pipe(
    map(() => true),
    catchError(() => of(router.parseUrl('/sign-in'))),
  );
};
