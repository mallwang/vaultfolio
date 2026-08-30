# Data Model: App Shell Restructure

This feature is a frontend routing/layout restructure — no persisted database entities change. The
"entities" below are client-side UI/routing concepts.

## Auth Status (new)

A tri-state signal read by the header and the authenticated shell to decide what to render, closing
the "flash of wrong state" gap called out in the spec's Edge Cases.

| State             | Meaning                                                       | Header shows                                 | Sidebar shows |
| ----------------- | ------------------------------------------------------------- | -------------------------------------------- | ------------- |
| `unknown`         | Session check not yet resolved (app just bootstrapped)        | Brand only — no name/role/sign-out           | Absent        |
| `authenticated`   | Session check (or sign-in) succeeded; `SessionUser` available | Brand + display name + role badge + sign-out | Present       |
| `unauthenticated` | Session check failed, or user signed out                      | Brand only — no name/role/sign-out           | Absent        |

**Transitions**:

- `unknown` → `authenticated` | `unauthenticated`: on app bootstrap, once the session check
  resolves (once per app load).
- `authenticated` → `unauthenticated`: on successful (or failed, per existing `completeSignOut`
  behavior) sign-out.
- `unauthenticated` → `authenticated`: on successful sign-in.
- Never transitions back to `unknown` after first resolution within a single app load.

**Source**: derived from the existing `CurrentUserStore` (holds the `SessionUser | null`) plus a
new "has the initial check completed" flag; not a new persisted concept, and not a new API field —
`SessionUser` (`libs/api-contract`) is unchanged.

## Application Area (existing, unchanged)

`APPLICATION_AREAS` (`core/layout/application-areas.ts`) — id, label, path, icon. Continues to
drive both the sidebar and the route table; this feature changes _where_ those paths are mounted
(`/app/<path>` instead of `/<path>`) but not the list itself or its shape.

## Route Map (new artifact of this feature)

The canonical mapping from legacy addresses to their `/app`-relocated equivalents, used to define
the redirect routes (FR-013):

| Legacy address | Canonical address | Guard       |
| -------------- | ----------------- | ----------- |
| `/dashboard`   | `/app/dashboard`  | `authGuard` |
| `/holdings`    | `/app/holdings`   | `authGuard` |
| `/imports`     | `/app/imports`    | `authGuard` |
| `/settings`    | `/app/settings`   | `authGuard` |
| `/` (root)     | `/app/dashboard`  | `authGuard` |

Public addresses (`/sign-in`, `/signup`, `/signup/verify/:token`, `/invite/:token`,
`/invite/expired`, `/account/*`) are unchanged — they already live directly under the base URL and
are out of scope for relocation (FR-003).

## Application Shell (existing entity, revised composition)

- **Header** (`AppHeaderComponent`): now rendered once at the application root, for every route.
  Reads Auth Status to decide identity-content visibility (FR-001, FR-008, FR-009).
- **Authenticated layout** (`AppShellComponent`, scope narrowed): sidebar + routed content,
  rendered only as the component for the `/app` parent route. No longer renders its own header
  (moved to root per Research #1).
- **Sidebar** (`AppSidebarComponent`, unchanged internally): rendered only within the
  authenticated layout, i.e. only reachable when `authGuard` has already permitted the route
  (FR-004, FR-006).
