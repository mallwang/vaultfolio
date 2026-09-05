# Contract: Route Table Changes (delta on 009/020)

**File**: [apps/frontend/src/app/app.routes.ts](../../../apps/frontend/src/app/app.routes.ts)

This extends 009's [contracts/routes.md](../../009-app-shell-restructure/contracts/routes.md)
(the base `/app/...` structure, legacy-redirect convention, and per-tab-address pattern), which
remains otherwise unchanged. Only the entries below are new or modified.

## Holdings (US3 — Imports relocation)

| Before                                                     | After                                                                                                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/holdings` → `HoldingsComponent` (list + distribution) | `app/holdings` → `HoldingsAreaComponent` (tabs container), `canActivate: [domainGuard('holdings')]` on the parent only                                                 |
| —                                                          | `app/holdings` children: `{ path: '', pathMatch: 'full', redirectTo: 'list' }`, `{ path: 'list', ... HoldingsComponent }`, `{ path: 'imports', ... ImportsComponent }` |
| `app/imports` → `ImportsComponent`, no domain guard        | Removed — see legacy redirects below                                                                                                                                   |

## Legacy redirects (updated)

| Address        | Before                      | After                                                                 |
| -------------- | --------------------------- | --------------------------------------------------------------------- |
| `/imports`     | `redirectTo: 'app/imports'` | `redirectTo: 'app/holdings/imports'` (FR-010)                         |
| `/app/imports` | (was the live route itself) | `redirectTo: 'holdings/imports'` (new redirect entry, child of `app`) |

Both preserve a pre-change bookmark exactly as 009's existing legacy-redirect convention already
does for `/dashboard`, `/holdings`, `/settings` (SC-006).

## Settings (US2 — per-domain tab)

| Before                                                          | After                                                                                                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/settings` children: `''→profile`, `profile`, `preferences` | Unchanged, **plus** one child per `SETTINGS_TAB_CONTRIBUTIONS` entry, each with `canActivate: [domainGuard(entry.domainId)]` (contracts/dashboard-settings-extension-points.md) |

## Admin (US4 — module relocation)

| Before                                                                         | After                                                                                                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `app/admin` → `import('./admin/admin.component')`, `canActivate: [adminGuard]` | `app/admin` → `import('@vaultfolio/frontend-admin').then(m => m.AdminComponent)`, `canActivate: [adminGuard]` (unchanged guard) |
| `app/admin` children (`accounts`, `signups`, `invitations`, `general`)         | Same paths/titles, each `loadComponent` now imports from `@vaultfolio/frontend-admin` instead of `./admin/...`                  |

No address, guard, or title changes for Admin — only the import source changes (Acceptance
Scenario 1, US4: "behavior is unchanged from before this change").

## Dashboard

No route change — `app/dashboard` continues to load `DashboardComponent` from
`apps/frontend/src/app/dashboard/dashboard.component.ts` unchanged; only that component's internal
rendering of widgets changes (contracts/dashboard-settings-extension-points.md).

## Navigation (`application-areas.ts`)

| Before                                                                               | After                          |
| ------------------------------------------------------------------------------------ | ------------------------------ |
| `{ id: 'imports', label: 'Imports', path: 'imports', icon: 'upload' }` entry present | Entry removed (FR-009, SC-004) |
| All other entries (`dashboard`, `holdings`, `settings`, `admin`)                     | Unchanged                      |
