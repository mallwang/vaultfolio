import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';
import { CurrentUserStore } from './current-user.store';

/**
 * Functional route guard (research.md #2/#8): authorizes/redirects based on
 * the Auth Status already resolved once at bootstrap
 * (`app.config.ts`'s `provideAppInitializer`) rather than issuing a second
 * `GET /api/auth/session` request per activation. By the time any guarded
 * route can activate, bootstrap has already resolved Auth Status away from
 * `'unknown'` (the app initializer blocks bootstrap on it), so only the
 * `'authenticated'` / `'unauthenticated'` branches matter here. The 401
 * interceptor (`authInterceptor`) handles the equivalent redirect for calls
 * made *after* a route has already activated (e.g. session expiry
 * mid-session).
 *
 * The deep link the user was headed for (`state.url`) is carried along as a
 * `redirect` query param so `SignInComponent` can send them there once they
 * authenticate, instead of always landing on the dashboard.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const currentUser = inject(CurrentUserStore);
  const router = inject(Router);

  return currentUser.status() === 'authenticated'
    ? true
    : router.parseUrl(`/sign-in?redirect=${encodeURIComponent(state.url)}`);
};
