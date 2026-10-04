import { DOCUMENT, Injectable, InjectionToken, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import type { SessionUser } from '@vaultfolio/api-contract';
import { AuthService } from './auth.service';
import { CurrentUserStore } from './current-user.store';

/** Full page loads, behind a token so specs can observe them instead of navigating jsdom. */
export interface PageLoader {
  assign(url: string): void;
  reload(): void;
}

export const PAGE_LOADER = new InjectionToken<PageLoader>('PAGE_LOADER', {
  providedIn: 'root',
  factory: () => {
    const { location } = inject(DOCUMENT);
    return { assign: (url) => location.assign(url), reload: () => location.reload() };
  },
});

/**
 * The one place where the signed-in identity of this page load may change. Stores, services and
 * components all over the app keep the user's data in memory, and no list of "things to reset"
 * stays complete as features are added — so whenever the identity changes or ends, the page is
 * loaded afresh instead, which drops every bit of in-memory state at once:
 *
 * - `leave()` — sign-out, account deletion, an expired session: always a full load.
 * - `enter()` — sign-in, invite acceptance, password reset: a full load if this page load already
 *   held a *different* user, an in-app navigation otherwise (nothing stale to drop).
 * - `watch()` — another tab of this browser shares the session cookie; when this tab becomes
 *   active again and the session now belongs to someone else (or to no one), it reloads.
 */
@Injectable({ providedIn: 'root' })
export class SessionBoundary {
  private readonly currentUser = inject(CurrentUserStore);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly pageLoader = inject(PAGE_LOADER);
  private readonly document = inject(DOCUMENT);
  private checking = false;

  enter(user: SessionUser, url: string): void {
    const previous = this.currentUser.current();
    if (previous && previous.id !== user.id) {
      this.pageLoader.assign(url);
      return;
    }
    this.currentUser.setAuthenticated(user);
    void this.router.navigateByUrl(url);
  }

  leave(url = '/sign-in'): void {
    this.currentUser.setUnauthenticated();
    this.pageLoader.assign(url);
  }

  watch(): void {
    const recheck = () => {
      if (this.document.visibilityState === 'visible') this.recheck();
    };
    this.document.addEventListener('visibilitychange', recheck);
    this.document.defaultView?.addEventListener('focus', recheck);
  }

  private recheck(): void {
    const shown = this.currentUser.current();
    if (!shown || this.checking) return;
    this.checking = true;
    this.authService.getSession().subscribe({
      next: (user) => {
        this.checking = false;
        if (user.id !== shown.id) this.pageLoader.reload();
      },
      error: (error: unknown) => {
        this.checking = false;
        // Only a definite "no session" counts; a network hiccup must not throw the user out.
        if (error instanceof HttpErrorResponse && error.status === 401) this.leave();
      },
    });
  }
}
