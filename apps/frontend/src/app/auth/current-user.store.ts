import { Injectable, signal } from '@angular/core';
import type { SessionUser } from '@vaultfolio/api-contract';

/**
 * Small signal-based cache of the signed-in user, populated wherever we
 * already fetch a `SessionUser` (sign-in, `authGuard`'s session check) so
 * components like the header can display it without an extra round trip.
 * Cleared on sign-out.
 */
@Injectable({ providedIn: 'root' })
export class CurrentUserStore {
  private readonly user = signal<SessionUser | null>(null);
  readonly current = this.user.asReadonly();

  set(user: SessionUser): void {
    this.user.set(user);
  }

  clear(): void {
    this.user.set(null);
  }
}
