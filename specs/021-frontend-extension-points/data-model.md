# Data Model: Frontend Shell Extension Points

**Feature**: 021-frontend-extension-points | **Date**: 2026-09-05

No backend/database entity is added or changed by this feature (unlike 020, which added
`domain_scopes`) — everything below is frontend-only, code-defined, and not persisted.

## Dashboard Widget Contribution

An optional piece of Dashboard content a domain library supplies (FR-001). Type declared in
`libs/frontend/domain-access`; instances declared in
`apps/frontend/src/app/dashboard/dashboard-widgets.registry.ts` (research.md #1–#2).

| Field           | Type                           | Notes                                                                                                                                                                    |
| --------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `domainId`      | `string`                       | Matches a `DomainDescriptor.id` (`DOMAIN_REGISTRY`) — the domain this widget belongs to.                                                                                 |
| `loadComponent` | `() => Promise<Type<unknown>>` | Dynamic import factory, e.g. `() => import('@vaultfolio/frontend-domain-holdings').then(m => m.HoldingsDistributionComponent)`. Never imported eagerly (research.md #3). |

Relationships:

- Exactly one per domain library, or none (Assumptions: "at most one dashboard widget... per
  domain").
- Shown on the Dashboard iff `isDomainEntitled(currentUser, domainId)` (FR-004).
- Rendered via `DynamicOutletComponent` (`libs/frontend/shared-ui`), one per entitled entry, in
  `DASHBOARD_WIDGET_CONTRIBUTIONS` array order (research.md #7).

## Settings Tab Contribution

An optional additional Settings tab a domain library supplies (FR-002), alongside the standard
Profile/Preferences tabs every signed-in user always has. Type declared in
`libs/frontend/domain-access`; instances declared in
`apps/frontend/src/app/settings/settings-tabs.registry.ts`.

| Field           | Type                           | Notes                                                                                               |
| --------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `domainId`      | `string`                       | Matches a `DomainDescriptor.id`.                                                                    |
| `path`          | `string`                       | Router path segment under `/app/settings`, e.g. `'holdings'`.                                       |
| `labelKey`      | `string`                       | i18n translation key for the tab label, matching `DomainDescriptor.labelKey`'s existing convention. |
| `loadComponent` | `() => Promise<Type<unknown>>` | Dynamic import factory for the tab's content component.                                             |

Relationships:

- Exactly one per domain library, or none (Assumptions).
- Spread into the `settings` route's `children` in `app.routes.ts`, each entry's route carrying
  `canActivate: [domainGuard(domainId)]` (research.md #4) — the same guard already used for a
  domain's main route.
- Shown as a Settings tab iff `isDomainEntitled(currentUser, domainId)` — computed the same way
  `AppSidebarComponent` already filters `APPLICATION_AREAS` (020).
- This spec ships the mechanism with zero live contributions (no new domain besides holdings is
  built here, and holdings itself only contributes a dashboard widget, not a settings tab, per
  Assumptions) — verified via a throwaway test domain per each User Story's Independent Test.

## Imports (relocated)

The existing holdings-data-import functionality (unchanged behavior), now represented as a child
route/tab of the Holdings area instead of its own navigation entry and route (FR-008–FR-011).

| Aspect           | Before                                                                | After                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation entry | `APPLICATION_AREAS` entry `{ id: 'imports', ... }`                    | Removed — no standalone entry (FR-009).                                                                                                                          |
| Route            | `/app/imports` → `apps/frontend/src/app/imports/imports.component.ts` | `/app/holdings/imports` → `ImportsComponent`, moved into `libs/frontend/domain/holdings`, rendered as a tab of the new `HoldingsAreaComponent` (research.md #5). |
| Access control   | Any signed-in user (no domain check)                                  | `domainGuard('holdings')` on the parent `holdings` route, inherited by the `imports` child (FR-011) — same rule as the rest of Holdings.                         |
| Legacy addresses | —                                                                     | `/imports` and `/app/imports` both `redirectTo` `/app/holdings/imports` (FR-010, SC-006).                                                                        |

## Verwaltung / Admin Module

The existing role-gated back-office area (Accounts, Sign-ups, Invitations, General), reorganized
into its own Nx library, distinct from both `apps/frontend`'s core layout and any product-domain
library (FR-012), continuing role-based (not domain-entitlement-based) access control (FR-013).

| Aspect         | Before                                                                            | After                                                                                                           |
| -------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Location       | `apps/frontend/src/app/admin/**`                                                  | `libs/frontend/admin` (`@vaultfolio/frontend-admin`)                                                            |
| Nx tag         | (none — part of `apps/frontend`, `scope:frontend`)                                | `scope:frontend-admin` (NEW tag, research.md #6)                                                                |
| Access control | `adminGuard` (`role === 'ADMIN'`), in `apps/frontend/src/app/auth/admin.guard.ts` | Unchanged — same guard, same file, same role check (FR-013). Only the guarded component's package changes.      |
| Sub-areas      | Accounts, Sign-ups, Invitations, General — child routes under `/app/admin`        | Unchanged behavior and addresses; components now live in and are lazy-loaded from `@vaultfolio/frontend-admin`. |

No new entity is introduced for Admin — this is purely a structural (Nx project) relocation with
no change to `SessionUser`, `role`, or any admin API contract.
