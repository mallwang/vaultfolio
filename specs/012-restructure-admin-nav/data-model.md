# Phase 1 Data Model: Restructure Admin & Settings Navigation

This feature introduces no persisted entities, no database schema changes, and no new API DTOs —
it is a UI-layer reorganization of navigation and routing over data that already exists
(accounts, sign-ups, invitations, health status, user profile). The only "model" affected is the
in-memory frontend navigation configuration.

## ApplicationArea (existing, modified)

Defined in `apps/frontend/src/app/core/layout/application-areas.ts`.

| Field   | Type          | Notes                                                                                                                                                                                                                                                            |
| ------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`    | `string`      | Unchanged. Unique nav item identifier.                                                                                                                                                                                                                           |
| `label` | `string`      | Unchanged. Display text.                                                                                                                                                                                                                                         |
| `path`  | `string`      | Unchanged. Routed as `/app/{path}`.                                                                                                                                                                                                                              |
| `icon`  | `string`      | Unchanged. PrimeIcons class.                                                                                                                                                                                                                                     |
| `roles` | `UserRole[]?` | **NEW, optional.** When present, the area is rendered only for a current user whose `role` is included; absent means visible to all authenticated roles (Dashboard, Holdings, Imports, Settings keep this unset). The new `Admin` entry sets `roles: ['ADMIN']`. |

`UserRole` is the existing `'ADMIN' | 'MEMBER'` union already defined in
`libs/api-contract/src/lib/auth.ts` (`SessionUser.role`) — no new type is introduced, this field
just reuses it.

**Validation/behavior rule**: `AppSidebarComponent` filters `APPLICATION_AREAS` against
`currentUserStore.current()?.role` before rendering (FR-005, FR-006, SC-002). This is a rendering
filter only — it is not the enforcement boundary (see `AdminGuard` below and Constitution
Principle II: the backend `RolesGuard` remains the authority).

## AdminGuard (new, route-level, not a data entity)

Functional `CanActivateFn` in `apps/frontend/src/app/auth/admin.guard.ts`. No state of its own;
reads `CurrentUserStore.current()?.role` at activation time and either allows navigation to
`/app/admin` or redirects to `/app/dashboard` (FR-007). Mirrors `auth.guard.ts`'s shape.

## Settings / Admin area membership (post-restructure)

No new entity — this documents the resulting grouping so tasks/implementation stay aligned with
FR-002/FR-003/FR-004:

| Area     | Sections (unchanged content/behavior)                            | Visible to       |
| -------- | ---------------------------------------------------------------- | ---------------- |
| Admin    | Accounts, Sign-ups, Invitations, General (health status)         | ADMIN only       |
| Settings | Profile, Preferences (placeholder, unchanged "coming soon" copy) | ADMIN and MEMBER |

No state transitions apply — this table is a static, role-scoped grouping of existing screens.
