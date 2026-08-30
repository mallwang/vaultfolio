---
description: 'Task list for App Shell Restructure'
---

# Tasks: App Shell Restructure

**Input**: Design documents from `/specs/009-app-shell-restructure/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/routes.md](./contracts/routes.md),
[quickstart.md](./quickstart.md)

**Tests**: Included — the constitution's Principle IV (Integration Testing) and plan.md's
Constitution Check explicitly call for route-table and guard-on-parent-route integration tests for
this module-boundary change (router ↔ guard ↔ shell ↔ header).

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P1/P1/P2) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- All paths are under `apps/frontend/src/app/` unless noted otherwise

## Path Conventions

Nx monorepo — this feature touches only the `frontend` Nx project (`apps/frontend/src/app/`), per
plan.md's Project Structure. No backend or `libs/` changes.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared test scaffolding used by multiple user stories' tests below.

- [ ] T001 [P] Add a reusable Auth Status test helper (a fake/override for `CurrentUserStore` that
      can be set to `unknown` / `authenticated` / `unauthenticated`) in
      `apps/frontend/src/app/auth/testing/current-user-store.testing.ts`, for use by the guard,
      header, and shell integration tests added in later phases

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The tri-state Auth Status mechanism (research.md #2, data-model.md "Auth Status")
that the header (US1/US4) and the guard/shell (US2/US3) all depend on to avoid a flash of the
wrong signed-in/signed-out state.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 Extend `CurrentUserStore` in `apps/frontend/src/app/auth/current-user.store.ts` with a
      tri-state Auth Status signal (`'unknown' | 'authenticated' | 'unauthenticated'`, starting at
      `'unknown'`) and `setAuthenticated(user: SessionUser)` / `setUnauthenticated()` methods,
      replacing the current `set()`/`clear()` API
- [ ] T003 Add bootstrap Auth Status resolution via Angular's `provideAppInitializer` in
      `apps/frontend/src/app/app.config.ts`: call `AuthService.getSession()` once at startup and
      populate `CurrentUserStore`'s Auth Status (`setAuthenticated` on success,
      `setUnauthenticated` on failure) before the app finishes bootstrapping (depends on: T002)
- [ ] T004 Update `authGuard` in `apps/frontend/src/app/auth/auth.guard.ts` to authorize/redirect
      based on the already-resolved Auth Status on `CurrentUserStore` instead of issuing a second
      `GET /api/auth/session` request per activation (research.md #2 — "not duplicating" the
      bootstrap check) (depends on: T002, T003)
- [ ] T005 [P] Unit test for the tri-state Auth Status transitions
      (`unknown` → `authenticated`/`unauthenticated`, `authenticated` → `unauthenticated`) in
      `apps/frontend/src/app/auth/current-user.store.spec.ts` (depends on: T002)

**Checkpoint**: Foundation ready — Auth Status is resolvable once at bootstrap and readable by any
component/guard; user story implementation can now begin.

---

## Phase 3: User Story 1 - Consistent header across the whole application (Priority: P1) 🎯 MVP

**Goal**: The same `AppHeaderComponent` renders on every route, public or authenticated, showing
identity content (name, role badge, sign-out) only once Auth Status is known to be `authenticated`.

**Independent Test**: Visit a public page (e.g. `/sign-in`) and an authenticated page (e.g.
dashboard) and confirm the header is present in both, with identity content shown only in the
authenticated case.

### Tests for User Story 1

- [ ] T006 [P] [US1] Update `apps/frontend/src/app/app.spec.ts`: the header renders for a public
      route and for an authenticated route, and shows no name/role-badge/sign-out content while
      Auth Status is `unknown` or `unauthenticated` (uses the T001 test helper)

### Implementation for User Story 1

- [ ] T007 [US1] Update `apps/frontend/src/app/app.ts`: remove the `shellless` computed property
      and its route-based toggle logic, remove the `AppShellComponent` import, and import
      `AppHeaderComponent` so the header is available to render unconditionally
- [ ] T008 [US1] Update `apps/frontend/src/app/app.html` to render `<app-header />` unconditionally
      followed by `<router-outlet />` (removing the `@if (shellless())` conditional) (depends on:
      T007)
- [ ] T009 [US1] Remove `AppHeaderComponent` from `AppShellComponent`'s imports and template in
      `apps/frontend/src/app/core/layout/app-shell/app-shell.component.ts` and
      `app-shell.component.html`, narrowing the shell to sidebar + routed content only
- [ ] T010 [US1] Adjust `apps/frontend/src/app/core/layout/app-shell/app-shell.component.css`: drop
      the header-only `.app-main` flex wrapper now that the header lives outside the shell, while
      preserving the `232px 1fr` grid, content padding, and mobile breakpoint (design.md's layout
      note: don't let this change clobber the shell's own `display: grid`) (depends on: T009)
- [ ] T011 [US1] Update `apps/frontend/src/app/core/layout/app-header/app-header.component.ts` to
      read the tri-state Auth Status (instead of the raw `CurrentUserStore.current` value) so
      `user`/`roleLabel`/`userInitials` resolve to "signed out" whenever status isn't
      `authenticated`, and update `signOut()`/`completeSignOut()` to call the new
      `setUnauthenticated()` (depends on: T002, T004)
- [ ] T012 [US1] Update `apps/frontend/src/app/core/layout/app-header/app-header.component.html` to
      wrap the name/role-badge/avatar/sign-out block in a condition on Auth Status being
      `authenticated`, so it renders only when signed in (depends on: T011)

**Checkpoint**: The header is present on every route; identity content only appears once signed in,
with no flash of the wrong state.

---

## Phase 4: User Story 2 - Authenticated pages relocated under /app (Priority: P1)

**Goal**: Dashboard, holdings, imports, and settings are reachable only under `/app/...`; public
pages keep their existing base-URL addresses; legacy (pre-`/app`) addresses keep working via
redirect.

**Independent Test**: Sign in and confirm every authenticated page is reachable at a `/app/...`
address; confirm a public page is reachable directly at the base URL with no `/app` prefix; confirm
a legacy address (e.g. `/dashboard`) redirects to its `/app` equivalent.

### Tests for User Story 2

- [ ] T013 [P] [US2] Add a route-table integration test per
      [contracts/routes.md](./contracts/routes.md) in `apps/frontend/src/app/app.routes.spec.ts`
      (new file): authenticated paths resolve under `/app/*` guarded by `authGuard`, public paths
      carry no `/app` prefix, the legacy paths (`/`, `/dashboard`, `/holdings`, `/imports`,
      `/settings`) redirect to their `/app` equivalents, and an unauthenticated visitor requesting
      any `/app/...` address is redirected to `/sign-in`

### Implementation for User Story 2

- [ ] T014 [US2] Restructure `apps/frontend/src/app/app.routes.ts`: introduce an `app` parent route
      with `canActivate: [authGuard]` and `component: AppShellComponent`, nesting the `dashboard`,
      `holdings`, `imports`, and `settings` routes as its children (same path segments, now
      relative to `app/`)
- [ ] T015 [US2] Add legacy `redirectTo` routes for `/dashboard`, `/holdings`, `/imports`, and
      `/settings` to their `/app/...` equivalents, and change the root `''` redirect from
      `dashboard` to `app/dashboard`, in `apps/frontend/src/app/app.routes.ts` (depends on: T014)
- [ ] T016 [US2] Add a child `**` wildcard route under the `app` parent rendering
      `NotFoundComponent` (inheriting the parent's `authGuard`), keeping the existing top-level
      `**` wildcard for unmatched public addresses, in `apps/frontend/src/app/app.routes.ts`
      (depends on: T014)
- [ ] T017 [P] [US2] Update the `activeAreaTitle` URL matching in
      `apps/frontend/src/app/core/layout/app-header/app-header.component.ts` to match against
      `/app/<path>` instead of `/<path>` (depends on: T014)
- [ ] T018 [P] [US2] Update the hardcoded post-action navigations from `/dashboard` to
      `/app/dashboard` in `apps/frontend/src/app/auth/sign-in/sign-in.component.ts`,
      `apps/frontend/src/app/invite/accept/accept.component.ts`, and
      `apps/frontend/src/app/account/reset-password/reset-password.component.ts`
- [ ] T019 [P] [US2] Update `routerLink="/dashboard"` to `routerLink="/app/dashboard"` in
      `apps/frontend/src/app/core/layout/not-found/not-found.component.html`

**Checkpoint**: All authenticated pages are reachable only under `/app/*`; public pages are
unaffected; legacy addresses redirect correctly.

---

## Phase 5: User Story 3 - Side-navigation appears only for signed-in users (Priority: P1)

**Goal**: The sidebar is present on every `/app/*` page (immediately after sign-in, no refresh
needed) and absent from every public page and after sign-out.

**Independent Test**: Load a public page and confirm no sidebar is present; sign in and confirm the
sidebar appears and lists the four authenticated areas; sign out and confirm it disappears.

### Tests for User Story 3

- [ ] T020 [P] [US3] Add an integration test in
      `apps/frontend/src/app/core/layout/app-shell/app-shell.component.spec.ts` (new file): the
      sidebar renders within the `app` route tree and lists the four `APPLICATION_AREAS` entries,
      and the `/app/*` route tree is unreachable (redirects to `/sign-in`) when Auth Status is not
      `authenticated`

### Implementation for User Story 3

- [ ] T021 [US3] Update the `routerLink` targets in
      `apps/frontend/src/app/core/layout/app-sidebar/app-sidebar.component.html` from
      `['/', area.path]` to `['/app', area.path]` so in-app navigation stays under `/app/*`
      (depends on: T014)

**Checkpoint**: The sidebar is visible on 100% of authenticated pages (appearing immediately after
sign-in) and absent from 100% of public pages and after sign-out — largely a consequence of T009's
narrowed shell and T014's route nesting, confirmed by T020.

---

## Phase 6: User Story 4 - Header shows the signed-in user's identity and sign-out control (Priority: P2)

**Goal**: While signed in, the header reliably shows the user's display name, role badge, and a
working sign-out control on every authenticated page.

**Independent Test**: Sign in and confirm the header shows display name, role badge, and a
sign-out control that successfully ends the session when activated.

### Tests for User Story 4

- [ ] T022 [P] [US4] Add an integration test in
      `apps/frontend/src/app/core/layout/app-header/app-header.component.spec.ts` (new file): a
      signed-in header shows the display name and role badge, and activating sign-out clears Auth
      Status and navigates to `/sign-in` with no identity content or sidebar visible afterward
      (uses the T001 test helper)

**Checkpoint**: All four user stories are independently functional — this story's implementation
was already delivered by T011/T012 (Auth-Status-gated identity content) and needed only its own
test coverage, per FR-008/FR-009/FR-010.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification across all stories and stale-comment cleanup.

- [ ] T023 [P] Update the doc comments in `apps/frontend/src/app/app.ts` and
      `apps/frontend/src/app/app.routes.ts` that describe the old shell-less/flat-route behavior to
      reflect the new always-on header and `/app` parent route
- [ ] T024 Run `npx nx run frontend:lint` and fix any findings from removed imports/unused code
- [ ] T025 Run `npx nx run frontend:test` and confirm all existing and new specs pass
- [ ] T026 Walk through [quickstart.md](./quickstart.md) scenarios 1–4 and its edge cases manually
      against `npm exec nx run-many -t serve -p backend,frontend`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (needs Auth Status from T002–T004)
- **User Story 2 (Phase 4)**: Depends on Foundational; independent of US1's header changes, but
  T017 (US2) touches the same file as T011/T012 (US1) — sequence US1 before US2 to avoid rework,
  or coordinate if run in parallel
- **User Story 3 (Phase 5)**: Depends on Foundational and on US2's route nesting (T014) for T021
- **User Story 4 (Phase 6)**: Depends on Foundational and on US1's header gating (T011, T012) —
  its test task exercises implementation already delivered by US1
- **Polish (Phase 7)**: Depends on all four user stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundational only — no dependency on US2/US3/US4
- **US2 (P1)**: Foundational only — no dependency on US1/US3/US4, but touches
  `app-header.component.ts` (T017) alongside US1's T011
- **US3 (P1)**: Foundational + US2's `app` parent route (T014) for its sidebar `routerLink` update
- **US4 (P2)**: Foundational + US1's header gating (T011, T012) — this story is test-only on top of
  US1's implementation

### Within Each User Story

- Tests before implementation (write first, confirm they fail against pre-restructure code)
- `app.ts`/`app.html` changes (US1) before shell narrowing depends on nothing but each other
- Route restructure (T014) before its dependents (T015–T019, T021)

### Parallel Opportunities

- T001 (Setup) has no dependencies
- T002 and T005 can start together once T001 is done; T003/T004 are sequential after T002
- Once Foundational (Phase 2) completes: US1 and US2 can proceed in parallel (different files,
  except the shared touch on `app-header.component.ts` between T011/T012 and T017 — recommend
  finishing US1 first if working solo)
- Within US2: T017, T018, T019 are all `[P]` (different files, all depend only on T014)
- US3's T021 and US4's T022 can each start as soon as their respective dependencies (T014; T011/T012)
  are done

---

## Parallel Example: User Story 2

```bash
# Once T014 (the `app` parent route) lands, these can run together:
Task: "Update activeAreaTitle URL matching in app-header.component.ts"
Task: "Update hardcoded /dashboard navigations in sign-in, accept, reset-password components"
Task: "Update routerLink=/dashboard in not-found.component.html"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (Auth Status — CRITICAL, blocks all stories)
3. Complete Phase 3: User Story 1 (header always visible, correctly gated)
4. **STOP and VALIDATE**: Test User Story 1 independently (quickstart Scenario 1)
5. Deploy/demo if ready — this alone fixes the "public pages render with no shell at all" gap

### Incremental Delivery

1. Setup + Foundational → Auth Status ready
2. Add US1 → header everywhere, correctly gated → validate → demo
3. Add US2 → `/app` routing + legacy redirects → validate → demo
4. Add US3 → sidebar visibility tied to the new route structure → validate → demo
5. Add US4 → identity/sign-out test coverage on top of US1 → validate → demo
6. Polish → lint/test/quickstart pass

### Notes

- [P] tasks = different files, no dependencies among them
- US1, US2, and US3 are all P1 per spec.md but are still sequenced above (US1 → US2 → US3) because
  of real code dependencies (US3's sidebar link needs US2's `/app` route; US1 and US2 both touch
  `app-header.component.ts`), not because of priority
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
