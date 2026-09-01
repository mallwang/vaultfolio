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
 *
 * The bootstrap `getSession()` probe (app.config.ts's provideAppInitializer)
 * also 401s for any anonymous visitor — which is the normal case on public
 * pages like `/signup`, `/signup/verify/:token`, `/invite/:token`, and
 * `/account/reset-password/:token`. Excluded here too, otherwise this
 * redirect wins the race against the router activating those routes and
 * hijacks anonymous visitors away from the public page they came to.
 *
 * The page the user was on when their session expired is carried along as a
 * `redirect` query param, same as `authGuard`, so `SignInComponent` can
 * return them there after they sign back in.
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
      const isSessionProbe = req.url.endsWith('/api/auth/session');

      if (isUnauthorized && !isSignInCall && !isSessionProbe) {
        const currentUrl = router.url;
        const redirect =
          currentUrl && currentUrl !== '/' && !currentUrl.startsWith('/sign-in')
            ? `?redirect=${encodeURIComponent(currentUrl)}`
            : '';
        router.navigateByUrl(`/sign-in${redirect}`);
      }
      return throwError(() => error);
    }),
  );
};
