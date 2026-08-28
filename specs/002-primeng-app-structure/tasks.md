---
description: 'Task list for PrimeNG UI Foundation & Application Structure'
---

# Tasks: PrimeNG UI Foundation & Application Structure

**Input**: Design documents from `/specs/002-primeng-app-structure/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/application-areas.md, quickstart.md, design.md

**Tests**: Not explicitly requested for this UI-only shell (plan.md: "no new contract/integration tests required"). No test tasks are included; existing Jest/Angular Testing Library conventions apply to any new `.spec.ts` files only incidentally (e.g. the moved health-status spec).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

All paths are under `apps/frontend/` (existing Nx Angular app) — see plan.md's Project Structure. No new Nx lib is created.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install PrimeNG and wire up global theming/routing infrastructure

- [ ] T001 Add `primeng@22.1.0`, `@primeuix/themes`, and `primeicons` as dependencies of `apps/frontend` in `package.json` (repo root), then run `npm install` (research.md §1)
- [ ] T002 Import PrimeIcons CSS in `apps/frontend/src/styles.css` (research.md §3)
- [ ] T003 Configure `providePrimeNG({ theme: { preset: Aura } })` in `apps/frontend/src/app/app.config.ts`, importing `Aura` from `@primeuix/themes/aura` (research.md §2, data-model.md "Theme")
- [ ] T004 Add `provideRouter(routes)` to `apps/frontend/src/app/app.config.ts`, importing an (initially empty) `routes` array from a new `apps/frontend/src/app/app.routes.ts` (research.md §5)

**Checkpoint**: `npm exec nx serve frontend` builds with PrimeNG theme + router providers wired, no visible change yet (app.html still renders health-status directly).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the navigation shell, area registry, and routing skeleton that every user story's areas mount into. **No user story content can be verified until this phase is done.**

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create `apps/frontend/src/app/core/layout/application-areas.ts` exporting the `APPLICATION_AREAS` list (id/label/path/icon per contracts/application-areas.md's route table: dashboard `pi-home`, holdings `pi-briefcase`, imports `pi-upload`, settings `pi-cog`) and the `ApplicationArea` type (data-model.md)
- [ ] T006 [P] Create `apps/frontend/src/app/core/layout/not-found/not-found.component.ts` (+ `.html`, `.css`) — centered icon + message + "Back to Dashboard" `routerLink`, standalone component (design.md "Not found", FR-006)
- [ ] T007 [P] Create `apps/frontend/src/app/core/layout/app-header/app-header.component.ts` (+ `.html`, `.css`) — "Vaultfolio" eyebrow/crumb, active area title, user-identity placeholder on the right (design.md "Header")
- [ ] T008 Create `apps/frontend/src/app/core/layout/app-sidebar/app-sidebar.component.ts` (+ `.html`, `.css`) — reads `APPLICATION_AREAS` (T005), renders desktop sidebar nav list with `routerLink`/`routerLinkActive="aria-current"` styling, and a mobile horizontally-scrollable top-bar variant of the same items, toggled via CSS media query (design.md "Sidebar navigation", research.md §4, §7, FR-009)
- [ ] T009 Create `apps/frontend/src/app/core/layout/app-shell/app-shell.component.ts` (+ `.html`, `.css`) — composes `app-sidebar` + `app-header` + `<router-outlet>` in the two-region layout from design.md's ASCII diagram (FR-003, FR-004)
- [ ] T010 Update `apps/frontend/src/app/app.ts` and `apps/frontend/src/app/app.html` to render `<app-shell>` as the root template instead of `<app-health-status>` directly
- [ ] T011 Populate `apps/frontend/src/app/app.routes.ts` with the route table: `''` redirects to `/dashboard`, one route per `APPLICATION_AREAS` entry (dashboard/holdings/imports/settings, lazy-loaded standalone components — created in Phase 3–5), and a trailing `**` wildcard route to `NotFoundComponent` (T006) (research.md §5, contracts/application-areas.md)

**Checkpoint**: Foundation ready — shell renders with sidebar/header/not-found wired to routing; individual area components (created next) can now be dropped in independently.

---

## Phase 3: User Story 1 - Consistent Look and Feel Across the App (Priority: P1) 🎯 MVP

**Goal**: Every screen (nav shell + placeholder areas + relocated health-status) renders exclusively via PrimeNG components under the Aura theme — no unstyled native controls.

**Independent Test**: Open the running app; visually/programmatically confirm the health-status view (and shell) render using PrimeNG's shared styling (buttons, layout containers, typography follow one visual language) uniformly.

### Implementation for User Story 1

- [ ] T012 [US1] Move `apps/frontend/src/app/health-status/` (component, template, styles, spec) to `apps/frontend/src/app/settings/health-status/`, updating the moved spec's import paths (FR-007, plan.md Project Structure)
- [ ] T013 [US1] Create `apps/frontend/src/app/settings/settings.component.ts` (+ `.html`, `.css`) — standalone component with two stacked sections: "System health" embedding `<app-health-status>` (T012) and a "Preferences" placeholder marked "Coming soon" (design.md "Settings")
- [ ] T014 [US1] Replace any bespoke/native styling in `HealthStatusComponent`'s template (`apps/frontend/src/app/settings/health-status/health-status.component.html`) with PrimeNG components (e.g. `Card`/`Tag`/`Message` for per-check status) so it matches Aura's visual language, preserving its existing healthy/unhealthy-per-check output (FR-001, FR-007, SC-002, SC-005)
- [ ] T015 [US1] Verify no unstyled native `<button>`/`<select>`/etc. controls remain in `app-shell`, `app-header`, `app-sidebar`, `not-found`, and `settings` templates (SC-002) — swap any found for PrimeNG equivalents

**Checkpoint**: User Story 1 is independently testable — load `/settings`, confirm PrimeNG/Aura styling throughout and unchanged health-status behavior.

---

## Phase 4: User Story 2 - Predictable Navigation Shell for New Screens (Priority: P1) 🎯 MVP

**Goal**: A persistent nav shell (sidebar desktop / scrollable top bar mobile) lists all four areas, routes between them updating only the content region, and shows an in-shell not-found state.

**Independent Test**: Load the app; confirm the shell is present with all four areas listed; click each entry and confirm only the content region changes while the shell persists and the active entry is indicated; navigate to a bad route and confirm the in-shell not-found state.

### Implementation for User Story 2

- [ ] T016 [P] [US2] Create `apps/frontend/src/app/dashboard/dashboard.component.ts` (+ `.html`, `.css`) — three placeholder stat-card shells (Total value / Today's change / Allocation, "— pending —") plus an empty-state panel, built from PrimeNG `Card`/`Tag` (design.md "Dashboard", FR-005)
- [ ] T017 [P] [US2] Create `apps/frontend/src/app/holdings/holdings.component.ts` (+ `.html`, `.css`) — PrimeNG `Table` shell with columns Ticker/Name/Quantity/Value and an empty-state row (design.md "Holdings", FR-005)
- [ ] T018 [P] [US2] Create `apps/frontend/src/app/imports/imports.component.ts` (+ `.html`, `.css`) — dropzone-style empty state using PrimeNG components (design.md "Imports", FR-005)
- [ ] T019 [US2] Wire `dashboard`, `holdings`, `imports`, `settings` (T013) components into `apps/frontend/src/app/app.routes.ts`'s route entries created in T011 (depends on T011, T016–T018, T013)
- [ ] T020 [US2] Confirm `app-sidebar` (T008) renders `aria-current="page"` on the active entry for each of the four routes and that the mobile top-bar variant keeps all four areas reachable at ~375px width (FR-009, quickstart.md scenario 2)
- [ ] T021 [US2] Manually verify quickstart.md scenario 3 (not-found handling): navigating to a nonexistent path renders `NotFoundComponent` inside the shell with a working "Back to Dashboard" link (FR-006)

**Checkpoint**: User Stories 1 AND 2 both work independently — full navigation shell functional across all four areas plus not-found, at desktop and mobile widths.

---

## Phase 5: User Story 3 - Reusable Foundation for Future Feature Screens (Priority: P2)

**Goal**: The application structure (folder conventions, shared layout, theme, area-registration contract) is documented so a developer can add a new placeholder area in under 30 minutes using only the docs.

**Independent Test**: A developer follows only `apps/frontend/README.md` + `contracts/application-areas.md` to add one new placeholder area; it appears in navigation, is reachable, and matches existing styling with no extra CSS.

### Implementation for User Story 3

- [ ] T022 [US3] Create `apps/frontend/README.md` documenting: where shared layout/navigation code lives (`core/layout/`), where theming is configured (`app.config.ts`), the folder-per-area convention under `apps/frontend/src/app/`, and a step-by-step "add a new Application Area" walkthrough matching `contracts/application-areas.md`'s 4 steps (FR-008)
- [ ] T023 [US3] Dry-run `contracts/application-areas.md`'s "Adding a new area" steps end-to-end (e.g. a throwaway `example` area) to confirm the documented steps are sufficient and accurate before finalizing T022; remove the throwaway area afterward (SC-003 validation)

**Checkpoint**: All user stories independently functional; structure is documented and validated as followable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories

- [ ] T024 [P] Run `npm exec nx lint frontend` and fix any violations introduced by this feature
- [ ] T025 [P] Run `npm exec nx test frontend` and fix any failures, including the moved `health-status.component.spec.ts` (T012)
- [ ] T026 Run through quickstart.md's full validation scenarios 1–6 end-to-end (`npm exec nx serve frontend`) and confirm each passes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — independently testable once done
- **User Story 2 (Phase 4)**: Depends on Foundational; T019 also depends on T013 (US1's Settings component) since all four areas are wired into routing together
- **User Story 3 (Phase 5)**: Depends on Foundational and benefits from US1+US2 being complete (documents the full pattern, and T023's dry-run needs working routing/nav)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependency on US2/US3
- **User Story 2 (P1)**: Can start after Foundational (Phase 2); T019 (route wiring) depends on Settings existing (US1's T013), so the two P1 stories finish together rather than in strict isolation — both are still independently _verifiable_ per their Independent Test sections once T019 lands
- **User Story 3 (P2)**: Can start after Foundational; its documentation and validation are most meaningful once US1/US2 exist to document

### Within Each User Story

- Shell/registry components before area components that plug into them
- Area components before route-wiring tasks that reference them
- Implementation before manual verification tasks

### Parallel Opportunities

- T006, T007 (not-found, header) can run in parallel — different files, no shared dependency beyond T005
- T016, T017, T018 (dashboard, holdings, imports components) can run in parallel — different files
- T024, T025 (lint, test) can run in parallel

---

## Parallel Example: Phase 2 (Foundational)

```bash
# After T005 (application-areas.ts) completes, launch together:
Task: "Create not-found component in apps/frontend/src/app/core/layout/not-found/"
Task: "Create app-header component in apps/frontend/src/app/core/layout/app-header/"
```

## Parallel Example: User Story 2

```bash
# Launch all three placeholder area components together:
Task: "Create dashboard component in apps/frontend/src/app/dashboard/"
Task: "Create holdings component in apps/frontend/src/app/holdings/"
Task: "Create imports component in apps/frontend/src/app/imports/"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 — both P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (health-status relocation + PrimeNG styling)
4. Complete Phase 4: User Story 2 (dashboard/holdings/imports + full nav + not-found)
5. **STOP and VALIDATE**: Run quickstart.md scenarios 1–5
6. Deploy/demo if ready — this is the MVP (both P1 stories satisfy the bulk of the spec)

### Incremental Delivery

1. Complete Setup + Foundational → shell renders, no areas yet
2. Add User Story 1 → PrimeNG styling + health-status relocated → verify independently
3. Add User Story 2 → all four areas + full nav + not-found → verify independently (MVP complete)
4. Add User Story 3 → README + contract dry-run → verify a new area can be added in <30 min
5. Polish → lint/test/full quickstart pass

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No tests were explicitly requested; T012's health-status spec move and T025's lint/test pass are the only test-touching tasks
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
