import { InjectionToken } from '@angular/core';
import type { SessionUser } from '@vaultfolio/api-contract';

/**
 * What `domainGuard`/`isDomainEntitled`'s consumers need to read the
 * currently signed-in user. Declared as an `InjectionToken` (rather than
 * importing `apps/frontend`'s `CurrentUserStore` directly) because this
 * library is `scope:shared` and may only depend on other `scope:shared`
 * libraries (contracts/module-boundaries.md) — `apps/frontend` provides the
 * concrete binding (`{ provide: CURRENT_USER_SOURCE, useExisting:
 * CurrentUserStore }`) once, in `app.config.ts`.
 */
export interface CurrentUserSource {
  current(): SessionUser | null;
}

export const CURRENT_USER_SOURCE = new InjectionToken<CurrentUserSource>('CURRENT_USER_SOURCE');
