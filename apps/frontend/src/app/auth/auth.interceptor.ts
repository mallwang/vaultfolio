import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/**
 * Redirects to `/sign-in` on any `401` response (research.md #8) — covers
 * the case where a session expires/is revoked mid-visit, after the route
 * guard already let the user in. The sign-in call itself also 401s on wrong
 * credentials; excluded here so `SignInComponent` can show its own inline
 * error instead of being redirected away from the page it's already on.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      const isUnauthorized =
        typeof error === 'object' &&
        error !== null &&
        (error as { status?: number }).status === 401;
      const isSignInCall = req.url.endsWith('/api/auth/sign-in');

      if (isUnauthorized && !isSignInCall) {
        router.navigateByUrl('/sign-in');
      }
      return throwError(() => error);
    }),
  );
};
