# Implementation Plan: Restructure Admin & Settings Navigation

**Branch**: `012-restructure-admin-nav` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-restructure-admin-nav/spec.md`

## Summary

Split the existing single "Settings" area into two role-scoped side-navigation destinations:
a new **Admin** entry (Accounts, Sign-ups, Invitations, General) visible only to ADMIN-role
users, and a trimmed **Settings** entry (Profile, Preferences) visible to everyone. This is a
frontend-only restructuring — no backend endpoints, DTOs, or role-enforcement logic change; the
backend already enforces ADMIN-only access on the relevant endpoints (`@Roles('ADMIN')` on
Accounts/Invitations/Sign-ups controllers), so FR-007/FR-008 are satisfied by (a) not calling
those endpoints from a MEMBER-visible surface and (b) adding a frontend route guard as
defense-in-depth/UX (avoids a broken/empty page flash) rather than as the security boundary.
The approach: move the four admin tab components into a new `admin/` feature folder with its own
route, component, and functional `adminGuard`; add an `Admin` entry to the shared
`APPLICATION_AREAS` nav model gated by role; promote the inline Preferences placeholder to its
own component alongside Profile in a slimmed-down Settings.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS runtime for the backend; unaffected by this feature)

**Primary Dependencies**: Angular (frontend) + PrimeNG (existing `p-tabs`/`p-tablist`/`p-tabpanels`
used by Settings today), Nx (monorepo tooling). No new dependencies are introduced.

**Storage**: N/A for this feature (no data model or persistence changes)

**Testing**: Jest + Angular Testing Library (Nx default) for component/guard unit tests; no new
backend integration tests needed since no backend contract changes

**Target Platform**: Modern evergreen browsers (Angular frontend); no backend/deployment changes

**Project Type**: Nx monorepo — frontend-only change within `apps/frontend`

**Performance Goals**: N/A — navigation/routing restructuring only, no new computation

**Constraints**: Must preserve all existing admin section functionality and content unchanged
(FR-002, FR-008); must not regress the existing `authGuard`-protected `/app` shell

**Scale/Scope**: ~6 existing components relocated/reorganized, 1 new guard, 1 new route, 1 nav
model entry; no new libs

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: N/A — no new/changed business logic; this restructures existing
  presentation-layer routing and component placement within `apps/frontend`. No domain logic is
  touched. **PASS**.
- **II. API-First Interface**: No backend API changes. Frontend continues to call the same
  existing endpoints from relocated components; no new endpoints, no bypassing the API. **PASS**.
- **III. Test Coverage**: No money/date/currency logic touched. New frontend logic (the
  `adminGuard` and the role-filtered nav list) will get standard component/unit test coverage per
  normal implement-then-test practice, no exact-value assertion requirement applies. **PASS**.
- **IV. Integration Testing**: No new library contracts, no new service-to-service communication,
  no schema changes. Existing admin section integration tests (if any) are unaffected since
  component behavior is preserved, only relocated. **PASS**.
- **V. Observability, Versioning & Simplicity**: No new abstractions beyond one guard and one
  route/component grouping needed to satisfy the role-visibility requirement (FR-005/006/007) —
  YAGNI-consistent. No versioned contract changes. **PASS**.

No violations — Complexity Tracking section not needed.

## Project Structure

### Documentation (this feature)

```text
specs/012-restructure-admin-nav/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output (navigation/UI model only — no persisted entities)
├── quickstart.md         # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature adds no new API endpoints and changes no existing
request/response schema — the backend surface is untouched (see Summary and Constitution Check
§II).

### Source Code (repository root)

```text
apps/frontend/src/app/
├── core/layout/
│   ├── application-areas.ts         # MODIFIED: add `Admin` area entry + role field/predicate
│   ├── app-sidebar/                 # MODIFIED: filter areas by current user role before render
│   └── app-shell/                   # unchanged
├── auth/
│   ├── auth.guard.ts                # unchanged (existing pattern to model the new guard on)
│   └── admin.guard.ts               # NEW: functional CanActivateFn, ADMIN-only, redirects otherwise
├── app.routes.ts                    # MODIFIED: add `app/admin` route (adminGuard) alongside `app/settings`
├── admin/                           # NEW feature folder (moved out of settings/)
│   ├── admin.component.ts           # NEW: tab container (Accounts, Sign-ups, Invitations, General)
│   ├── admin.component.html
│   ├── accounts/                    # MOVED from settings/accounts/ (unchanged internals)
│   ├── signups/                     # MOVED from settings/signups/ (unchanged internals)
│   ├── invitations/                 # MOVED from settings/invitations/ (unchanged internals)
│   └── health-status/               # MOVED from settings/health-status/ (unchanged internals)
└── settings/
    ├── settings.component.ts        # MODIFIED: tabs trimmed to Profile, Preferences only
    ├── settings.component.html
    ├── profile/                     # unchanged, stays under settings/
    └── preferences/                 # NEW: placeholder card promoted out of the old General tab
        └── preferences.component.ts # NEW: extracted "coming soon" content, no behavior change
```

**Structure Decision**: Single Nx application project (`apps/frontend`) — no `libs/frontend-*`
boundary exists or is warranted for this feature (per constitution's Library-First principle,
which targets domain logic, not presentation routing). All work is directory/component
reorganization plus two small new files (`admin.guard.ts`, `preferences.component.ts`) inside the
existing app. No backend (`apps/backend`) or shared (`libs/api-contract`, `libs/domain`) changes.

## Complexity Tracking

_Not applicable — no Constitution Check violations._
