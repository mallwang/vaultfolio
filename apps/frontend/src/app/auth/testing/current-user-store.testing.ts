import { signal } from '@angular/core';
import type { SessionUser } from '@vaultfolio/api-contract';
import type { AuthStatus } from '../current-user.store';

/**
 * Test double for `CurrentUserStore` (T001): lets a spec drive Auth Status
 * directly to `'unknown' | 'authenticated' | 'unauthenticated'` instead of
 * going through a real session check, so the guard, header, and shell specs
 * can exercise each state without an HTTP round trip.
 *
 * Usage: `{ provide: CurrentUserStore, useValue: new FakeCurrentUserStore() }`,
 * then call `setAuthenticated`/`setUnauthenticated`/`setUnknown` from the test.
 */
export class FakeCurrentUserStore {
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

  setUnknown(): void {
    this.user.set(null);
    this.authStatus.set('unknown');
  }
}
