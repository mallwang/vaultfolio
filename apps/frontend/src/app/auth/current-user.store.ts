import { Injectable, signal } from '@angular/core';
import type { SessionUser } from '@vaultfolio/api-contract';

/**
 * Tri-state Auth Status (data-model.md "Auth Status"): `'unknown'` until the
 * bootstrap session check (app.config.ts's `provideAppInitializer`)
 * resolves, then `'authenticated'` or `'unauthenticated'`. Never transitions
 * back to `'unknown'` after first resolution within a single app load. The
 * header and shell read this — not just `current` being null — so a signed-
 * out visitor and a not-yet-checked visitor are distinguishable (avoids the
 * "flash of wrong state" the spec's Edge Cases forbid).
 */
export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';

/**
 * Small signal-based cache of the signed-in user plus their Auth Status,
 * populated once at bootstrap and updated on sign-in/sign-out so components
 * like the header and shell can read both without an extra round trip.
 */
@Injectable({ providedIn: 'root' })
export class CurrentUserStore {
  private readonly user = signal<SessionUser | null>(null);
  private readonly authStatus = signal<AuthStatus>('unknown');

  readonly current = this.user.asReadonly();
  readonly status = this.authStatus.asReadonly();

  setAuthenticated(user: SessionUser): void {
    this.user.set(user);
    this.authStatus.set('authenticated');
  }

  setUnauthenticated(): void {
    this.user.set(null);
    this.authStatus.set('unauthenticated');
  }
}
