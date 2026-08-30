---
description: 'Task list template for feature implementation'
---

# Tasks: Restructure Admin & Settings Navigation

**Input**: Design documents from `/specs/012-restructure-admin-nav/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not explicitly requested in the spec. Test tasks below are limited to updating/moving
existing specs whose import paths break due to the move, plus the small set of new unit tests the
plan/quickstart explicitly call out (`AppSidebarComponent` role filter, `adminGuard`). No new
contract/integration test suites are introduced.

**Organization**: Tasks are grouped by user story per spec.md priorities (US1 P1, US3 P1, US2 P2).

## Path Conventions

Single Nx application project — all paths are under `apps/frontend/src/app/`.

---

## Phase 1: Setup

**Purpose**: Create the destination folder structure before moving anything into it.

- [ ] T001 Create empty `apps/frontend/src/app/admin/` directory structure (no files yet) to
      receive the relocated tab components

**Checkpoint**: Setup complete — no code changes yet, ready for foundational work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared model/guard changes that every user story's implementation depends on.

**⚠️ CRITICAL**: Complete before any user story phase below.

- [ ] T002 Add optional `roles?: UserRole[]` field to the `ApplicationArea` interface in
      `apps/frontend/src/app/core/layout/application-areas.ts`, importing `UserRole` from
      `@vaultfolio/api-contract` (data-model.md "ApplicationArea")
- [ ] T003 Create `apps/frontend/src/app/auth/admin.guard.ts`: a functional `CanActivateFn`
      `adminGuard` modeled on `apps/frontend/src/app/auth/auth.guard.ts`, checking
      `inject(CurrentUserStore).current()?.role === 'ADMIN'` and redirecting to
      `router.parseUrl('/app/dashboard')` otherwise (research.md "Decision: Route-level guard")

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Admin views moved to a dedicated Admin area (Priority: P1) 🎯 MVP

**Goal**: Accounts, Sign-ups, Invitations, and General (health status) live under a new `/app/admin`
route with their own tabbed container, no longer reachable from Settings.

**Independent Test**: Sign in as ADMIN, open the new Admin side-nav entry, confirm all four
sections present and functioning; confirm they are no longer shown in Settings.

### Implementation for User Story 1

- [ ] T004 [P] [US1] Move `apps/frontend/src/app/settings/accounts/` (component, service, css,
      html) to `apps/frontend/src/app/admin/accounts/` unchanged internally
- [ ] T005 [P] [US1] Move `apps/frontend/src/app/settings/signups/` (including `reject-dialog/`
      subfolder) to `apps/frontend/src/app/admin/signups/` unchanged internally
- [ ] T006 [P] [US1] Move `apps/frontend/src/app/settings/invitations/` (including
      `invite-dialog/` subfolder) to `apps/frontend/src/app/admin/invitations/` unchanged
      internally
- [ ] T007 [P] [US1] Move `apps/frontend/src/app/settings/health-status/` (including
      `health-status.component.spec.ts`) to `apps/frontend/src/app/admin/health-status/`
      unchanged internally
- [ ] T008 [US1] Create `apps/frontend/src/app/admin/admin.component.ts` +
      `admin.component.html` (+ `.css` if needed): a `p-tabs`/`p-tablist`/`p-tabpanels` container
      mirroring `settings.component.ts`'s existing pattern, with tabs Accounts, Sign-ups,
      Invitations, General, importing `AccountsComponent`, `SignupsComponent`,
      `InvitationsComponent`, `HealthStatusComponent` from their new `admin/` locations (depends
      on T004-T007)
- [ ] T009 [US1] Add the `app/admin` child route to `apps/frontend/src/app/app.routes.ts`
      (alongside `app/settings`, inside the `app` parent's `children`), lazy-loading
      `AdminComponent` from `./admin/admin.component`, gated with `canActivate: [adminGuard]`
      (depends on T003, T008)
- [ ] T010 [US1] Add an `Admin` entry to `APPLICATION_AREAS` in
      `apps/frontend/src/app/core/layout/application-areas.ts` (id `admin`, label `Admin`, path
      `admin`, an appropriate PrimeIcons icon, `roles: ['ADMIN']`) (depends on T002)
- [ ] T011 [US1] Remove Accounts, Sign-ups, Invitations, and General tabs (and their component
      imports) from `apps/frontend/src/app/settings/settings.component.ts` and
      `settings.component.html`, leaving only the Profile tab for now (depends on T004-T007;
      Preferences tab added in US2 below)
- [ ] T012 [P] [US1] Update import paths in any moved spec files
      (`apps/frontend/src/app/admin/health-status/health-status.component.spec.ts`) to reflect
      the new `admin/` location

**Checkpoint**: Admin area fully functional and reachable at `/app/admin` for ADMIN users;
Settings no longer references the moved components. Independently testable per spec.md.

---

## Phase 4: User Story 3 - Admin navigation hidden from non-admin users (Priority: P1)

**Goal**: MEMBER users never see the Admin side-nav entry and cannot reach `/app/admin` content
directly.

**Independent Test**: Sign in as MEMBER, confirm no "Admin" side-nav entry; sign in as ADMIN,
confirm it's present. Direct navigation to `/app/admin` as MEMBER redirects away.

### Implementation for User Story 3

- [ ] T013 [US3] Update `AppSidebarComponent`
      (`apps/frontend/src/app/core/layout/app-sidebar/app-sidebar.component.ts`) to filter
      `APPLICATION_AREAS` by `currentUserStore.current()?.role` before exposing them to the
      template — inject `CurrentUserStore`, expose a computed/filtered `areas` list omitting any
      area whose `roles` doesn't include the current role (depends on T002, T010)
- [ ] T014 [US3] Verify `apps/frontend/src/app/core/layout/app-sidebar/app-sidebar.component.html`
      requires no changes since it iterates over the component's `areas` property (confirm the
      `@for` binding still targets the filtered signal from T013); adjust the binding if the
      property name changed
- [ ] T015 [P] [US3] Add a unit test for `AdminGuard` (new
      `apps/frontend/src/app/auth/admin.guard.spec.ts`, modeled on any existing `auth.guard`
      test pattern if present) covering: ADMIN role → activates; MEMBER role → redirects to
      `/app/dashboard` (depends on T003)
- [ ] T016 [P] [US3] Add a unit test for the sidebar's role filter (extend or add
      `apps/frontend/src/app/core/layout/app-sidebar/app-sidebar.component.spec.ts`) covering:
      ADMIN sees the Admin entry; MEMBER does not (depends on T013)

**Checkpoint**: Admin nav entry and route are fully role-gated; MEMBER users cannot see or reach
Admin content. Combined with Phase 3, User Stories 1 and 3 (both P1) are complete.

---

## Phase 5: User Story 2 - Settings split into Profile and Preferences (Priority: P2)

**Goal**: Settings shows exactly two sections — Profile and Preferences — with Preferences holding
the extracted "coming soon" placeholder.

**Independent Test**: Sign in as any user, open Settings, confirm exactly two tabs (Profile,
Preferences) and that Preferences shows the placeholder content unchanged.

### Implementation for User Story 2

- [ ] T017 [US2] Create `apps/frontend/src/app/settings/preferences/preferences.component.ts` +
      `preferences.component.html` (+ `.css` if needed): extract the `p-card`/`p-tag` "Coming
      soon" placeholder markup (currently inside `settings.component.html`'s General tab) into
      this new standalone component, unchanged content (research.md "Decision: Preferences
      promoted to a small standalone component")
- [ ] T018 [US2] Add a `Preferences` tab to
      `apps/frontend/src/app/settings/settings.component.html`, alongside `Profile`, rendering
      `<app-preferences />`; update `settings.component.ts`'s `imports` to include
      `PreferencesComponent` and drop the now-unused `CardModule`/`TagModule` imports if nothing
      else in the component uses them (depends on T011, T017)
- [ ] T019 [US2] Confirm `settings.component.ts`/`.html` contain exactly two `p-tab`/`p-tabpanel`
      pairs (Profile, Preferences) and no leftover references to Accounts/Invitations/Signups/
      HealthStatus (depends on T018)

**Checkpoint**: Settings is trimmed to Profile + Preferences for every signed-in user, independent
of role. All three user stories now complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all three stories.

- [ ] T020 [P] Run `npx nx lint frontend` and fix any import-path or unused-import fallout from
      the moves (T004-T007, T011, T018)
- [ ] T021 [P] Run `npx nx test frontend` and fix any broken import paths in moved spec files or
      newly-added tests (T012, T015, T016)
- [ ] T022 Run `npx nx test backend` to confirm the unchanged `accounts.controller`,
      `signups.controller`, `invitations.controller` role-guard tests still pass (regression
      check, FR-008; no backend files are touched by this feature)
- [ ] T023 Execute the manual validation scenarios in `specs/012-restructure-admin-nav/quickstart.md`
      (Scenarios 1-3 + regression check) against `npx nx serve backend` /
      `npx nx serve frontend`, signed in as both an ADMIN and a MEMBER test user

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (T002 blocks T010/T013;
  T003 blocks T009/T015).
- **User Story 1 (Phase 3)**: Depends on Foundational. Must complete before Phase 5 (Settings
  trim removes the tabs Phase 3 relocates) but is independent of Phase 4.
- **User Story 3 (Phase 4)**: Depends on Foundational + T010 (the Admin area must exist in
  `APPLICATION_AREAS` before it can be filtered). Can run in parallel with the tail of Phase 3
  once T010 lands.
- **User Story 2 (Phase 5)**: Depends on Phase 3's T011 (General tab removed from Settings before
  Preferences is added in its place).
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- Phase 3: moves (T004-T007, parallel) → container component (T008) → route (T009) → nav entry
  (T010) → settings trim (T011) → spec import fixes (T012, parallel with T011)
- Phase 4: sidebar filter (T013) → template check (T014) → tests (T015, T016, parallel)
- Phase 5: extract component (T017) → wire into settings (T018) → verify (T019)

### Parallel Opportunities

- T004, T005, T006, T007 (independent component moves) can run in parallel.
- T015 and T016 (independent new test files) can run in parallel.
- T020 and T021 (lint vs. test) can run in parallel.
- Phase 4 (US3) can start as soon as T010 lands, in parallel with the remainder of Phase 3
  (T011-T012).

---

## Parallel Example: User Story 1 moves

```bash
Task: "Move apps/frontend/src/app/settings/accounts/ to apps/frontend/src/app/admin/accounts/"
Task: "Move apps/frontend/src/app/settings/signups/ to apps/frontend/src/app/admin/signups/"
Task: "Move apps/frontend/src/app/settings/invitations/ to apps/frontend/src/app/admin/invitations/"
Task: "Move apps/frontend/src/app/settings/health-status/ to apps/frontend/src/app/admin/health-status/"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 3, both P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Admin area exists and holds relocated sections)
4. Complete Phase 4: User Story 3 (Admin nav/route role-gated)
5. **STOP and VALIDATE**: Quickstart Scenarios 1 and 3
6. This is the MVP — admin content is relocated and properly access-controlled

### Incremental Delivery

1. Setup + Foundational → ready
2. User Story 1 → Admin area functional → validate (Scenario 1)
3. User Story 3 → Admin properly hidden/guarded → validate (Scenario 3) — **MVP complete**
4. User Story 2 → Settings trimmed to Profile + Preferences → validate (Scenario 2)
5. Polish → lint, tests, full quickstart pass

---

## Notes

- [P] tasks = different files, no dependencies on incomplete same-phase work
- [Story] label maps task to specific user story for traceability
- No `contracts/` directory exists for this feature (no backend API changes) — no contract tests
- Commit after each task or logical group per repo convention
- Stop at either P1 checkpoint (end of Phase 4) to validate the MVP independently of Settings
  trimming (Phase 5)
