# Implementation Plan: App Shell Restructure

**Branch**: `009-app-shell-restructure` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-app-shell-restructure/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Restructure the Angular app shell so the header renders on every route (public and authenticated),
authenticated pages move under `/app/*` (with legacy-address redirects), the sidebar shows only
when signed in, and the header's identity content (name, role badge, sign-out) shows only when
signed in — with no flash of the wrong state before auth status is known. Approach: hoist
`AppHeaderComponent` from `AppShellComponent` to the root `App` component so it's no longer tied to
the (now authenticated-only) shell; nest the four authenticated routes under a new `app` parent
route carrying `authGuard` once; add `redirectTo` routes for the old addresses; introduce a
tri-state Auth Status (`unknown | authenticated | unauthenticated`) resolved once at bootstrap so
the header/sidebar never render a guess before the session check completes. See
[research.md](./research.md) for the decisions and alternatives behind each of these.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS runtime for the backend)

**Primary Dependencies**: NestJS (backend, unaffected by this feature), Angular (frontend) — per
the constitution's Stack Decision. No new dependencies; reuses `AuthService`, `CurrentUserStore`,
`authGuard`, PrimeNG components already in use by `AppHeaderComponent`/`AppSidebarComponent`.

**Storage**: PostgreSQL — N/A for this feature (no data model or backend change; purely frontend
routing/layout).

**Testing**: Jest for existing unit specs on the affected Angular components/guard; component/route
tests updated for the new route table and shell composition (Principle IV — integration test for
the guard-on-parent-route contract change).

**Target Platform**: Modern evergreen browsers (Angular frontend). No backend or database change.

**Project Type**: web-service + frontend, Nx monorepo — this feature touches `apps/frontend` only.

**Performance Goals**: N/A — no new runtime cost beyond one additional session check already
performed today by `authGuard`, now run once at bootstrap instead of (or in addition to) per
protected-route activation; see research.md #2.

**Constraints**: No visual redesign (per spec Assumptions) — layout/CSS grid behavior from
[design.md](./design.md) must be preserved, including the noted "don't clobber the shell's own
`display: grid`" pitfall.

**Scale/Scope**: One Nx project (`apps/frontend`); ~4 existing route/layout files change
(`app.routes.ts`, `app.ts`/`app.html`, `app-shell.component.ts/html`, and the new Auth Status
mechanism), plus the four authenticated route paths and 5 legacy redirects.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: N/A — no domain/finance logic touched; this is routing/layout composition
  within `apps/frontend`. PASS.
- **II. API-First Interface**: No API contract changes — reuses the existing
  `GET /api/auth/session` and sign-out endpoints already consumed by `authGuard`/`AuthService`.
  PASS.
- **III. Test-First**: No monetary/financial calculations involved; standard test-first practice
  still applies to the guard/route/Auth Status behavior but the NON-NEGOTIABLE exact-value clause
  is not implicated. PASS.
- **IV. Integration Testing**: This feature is exactly the kind of module-boundary change the
  principle targets (router ↔ guard ↔ shell ↔ header contract). Plan includes route-table and
  guard-on-parent-route integration tests (Phase 2, `speckit-tasks`). PASS (tracked as a task, not
  yet written).
- **V. Observability, Versioning & Simplicity**: No new libraries or services introduced; reuses
  existing components and renames/relocates nothing that isn't necessary (research.md #4 explicitly
  rejects an unnecessary rename). PASS.

No violations — Complexity Tracking section not needed.

## Project Structure

### Documentation (this feature)

```text
specs/009-app-shell-restructure/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── routes.md        # Phase 1 output (/speckit-plan command)
├── design.md             # Approved shell mockup (pre-existing, from speckit-ux-review)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
├── backend/                  # NestJS — unaffected by this feature
└── frontend/                 # Angular — all changes for this feature live here
    └── src/app/
        ├── app.ts             # Root component: header now rendered here (unconditionally),
        │                      # plus the new Auth Status bootstrap check
        ├── app.html
        ├── app.routes.ts      # Restructured: `app` parent route (authGuard once) wraps
        │                      # dashboard/holdings/imports/settings; legacy redirects added
        ├── auth/
        │   ├── auth.guard.ts       # Unchanged logic, moved to apply once on the `app` parent
        │   └── current-user.store.ts  # Extended with the "has resolved" flag for Auth Status
        └── core/layout/
            ├── app-header/       # Unchanged internals; now instantiated from app.html, not
            │                     # app-shell.component.html
            ├── app-shell/        # Narrowed to sidebar + routed content only (drops header)
            └── app-sidebar/      # Unchanged

libs/
└── api-contract/             # Unchanged — `SessionUser` shape is not modified by this feature
```

**Structure Decision**: Entirely within the existing `apps/frontend` Nx project — no new Nx
app/lib is introduced. The change is a composition/routing restructure of existing components
(`app.ts`, `app.routes.ts`, `AppShellComponent`, `AppHeaderComponent`, `AppSidebarComponent`,
`authGuard`, `CurrentUserStore`), consistent with Principle V (no new abstraction without
justification) — see research.md for why each existing piece is kept rather than replaced.

## Complexity Tracking

> Not applicable — no Constitution Check violations to justify.
