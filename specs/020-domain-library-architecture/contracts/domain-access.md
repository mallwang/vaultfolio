# Contract: Shared Domain-Entitlement Mechanism

**Library**: `libs/frontend/domain-access` (`@vaultfolio/frontend-domain-access`, `scope:shared`)

This is the "one shared mechanism" FR-004/SC-003 require. Every consumer — the route guard and the
navigation filter — calls into this library; neither re-implements the check.

## Public API (`src/index.ts`)

```ts
export interface DomainDescriptor {
  id: string; // e.g. 'holdings'; matches SessionUser.domainScopes entries
  labelKey: string; // i18n key, e.g. 'nav.holdings'
  path: string; // router path segment under /app
  icon: string; // vf-icon semantic name
}

/** Every domain library registered in the codebase. Adding a domain = adding one entry here. */
export const DOMAIN_REGISTRY: DomainDescriptor[];

/**
 * The single source of truth for "can this user access this domain" (FR-004, SC-003).
 * - false for an unauthenticated user (user === null).
 * - true for role === 'ADMIN' regardless of domainScopes (FR-008).
 * - otherwise true iff domainId is present in user.domainScopes.
 */
export function isDomainEntitled(user: SessionUser | null, domainId: string): boolean;

/**
 * Functional route-guard factory (same shape as the existing `authGuard`/`adminGuard`), used as
 * `canActivate: [domainGuard('holdings')]` on a domain's route(s) (FR-005). Redirects the same way
 * `adminGuard` does today when not entitled — never a raw 403 page.
 */
export function domainGuard(domainId: string): CanActivateFn;
```

## Consumers

| Consumer                                                                 | Uses                                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `apps/frontend/src/app/app.routes.ts` (holdings route)                   | `domainGuard('holdings')` on `canActivate`                                           |
| `apps/frontend/src/app/core/layout/app-sidebar/app-sidebar.component.ts` | `isDomainEntitled(currentUser, area.domainId)` alongside the existing `roles` filter |
| `apps/frontend/src/app/admin/accounts/accounts.component.ts`             | `DOMAIN_REGISTRY` to render the domain-scope checkboxes                              |

## Backend counterpart (not part of this library — see data-model.md)

- `GET /api/auth/session`, sign-in response: `SessionUser.domainScopes: string[]` (existing endpoints,
  additive field).
- `PATCH /accounts/:id/domain-scopes` (NEW, `@Roles('ADMIN')`, mirrors the existing
  `PATCH /accounts/:id/role`): body `{ domainScopes: string[] }`, rejects any id not in
  `DOMAIN_REGISTRY`'s known set (validated against a backend-side copy of the domain id list — see
  Complexity Tracking in plan.md for why this list is duplicated rather than shared cross-tier).

## Verification (US3's Independent Test)

1. As an Administrator, revoke the `holdings` scope from a non-admin test user via the Accounts
   screen.
2. That user's next sign-in/session refresh: the Holdings nav entry is gone AND `/app/holdings`
   redirects away — both driven by the same `isDomainEntitled` call, so they cannot diverge.
3. Re-grant the scope: both come back together.
4. Confirm an Administrator retains Holdings access throughout, regardless of their own
   `domainScopes` value (FR-008).
