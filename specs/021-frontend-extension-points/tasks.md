---
description: 'Task list template for feature implementation'
---

# Tasks: Frontend Shell Extension Points

**Input**: Design documents from `/specs/021-frontend-extension-points/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Not explicitly requested by spec.md as a separate TDD phase. Per plan.md's Constitution
Check (Principles III/IV), ordinary unit/component-test coverage is expected as part of each
implementation task (existing specs move/extend with their code), so test-file work is folded into
the relevant implementation tasks below rather than a separate "write failing tests first" phase.

**Organization**: Tasks are grouped by user story (US1–US4, per spec.md's priorities) to enable
independent implementation and testing of each story. All four stories are designed to be
independent of one another (plan.md, research.md) and can be implemented/reviewed in any order
after Setup.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Nx monorepo: `apps/frontend/src/app/` (Angular shell), `libs/frontend/domain-access/src/`
(`scope:shared`), `libs/frontend/shared-ui/src/` (`scope:shared`),
`libs/frontend/domain/holdings/src/` (`scope:frontend-domain`), `libs/frontend/admin/src/` (NEW,
`scope:frontend-admin`) — per plan.md's Project Structure.

---

## Phase 1: Setup

**Purpose**: Confirm the baseline this feature builds on. This feature adds no new external
dependency and no new build/deploy target (plan.md Technical Context, Constraints) — the only new
project is the `libs/frontend/admin` library scaffolded within User Story 4 (Phase 5), since it is
that story's own concern, not shared setup.

- [ ] T001 Confirm `npm install` succeeds from repo root ([package.json](../../package.json)) and
      `npx nx graph` resolves cleanly with no new dependency added, establishing the clean baseline
      this feature's changes are diffed against (plan.md Technical Context: "adds no new external
      dependency")

---

## Phase 2: Foundational

**Purpose**: Blocking prerequisites shared by every user story.

**None required.** Per plan.md/research.md, the four extension points are deliberately
independent additive changes (two new type-only exports on `domain-access` used only by US1/US2
respectively, a component relocation for US3, and a library extraction for US4) — no shared
infrastructure change blocks more than one story. Proceed directly to the user story phases below.

---

## Phase 3: User Story 1 - A domain's dashboard contribution moves with the domain (Priority: P1) 🎯 MVP

**Goal**: The Dashboard renders whichever domains' dashboard widgets the current user is entitled
to, via a generic registry + dynamic-loading mechanism, with the existing Holdings distribution
widget retrofitted onto it unchanged (FR-001, FR-003, FR-004, FR-005).

**Independent Test**: Confirm the Dashboard still shows the Holdings distribution card unchanged
for an entitled user; add a throwaway second domain with its own dashboard contribution and confirm
it appears only for an entitled user, without editing `dashboard.component.ts`/`.html` beyond the
registry array (quickstart.md §1).

### Implementation for User Story 1

- [ ] T002 [P] [US1] Add `DashboardWidgetContribution` interface (`domainId: string`,
      `loadComponent: () => Promise<Type<unknown>>`) in
      `libs/frontend/domain-access/src/lib/dashboard-widget-contribution.ts`
      (contracts/dashboard-settings-extension-points.md)
- [ ] T003 [US1] Export `DashboardWidgetContribution` as a type-only export from
      `libs/frontend/domain-access/src/index.ts` (no new runtime export, no new dependency —
      research.md #2)
- [ ] T004 [P] [US1] Create `DynamicOutletComponent` (wraps `NgComponentOutlet`, `loader: input.required<() => Promise<Type<unknown>>>()`,
      resolves once as a signal) in
      `libs/frontend/shared-ui/src/lib/dynamic-outlet/dynamic-outlet.component.ts` +
      inline template (research.md #3)
- [ ] T005 [P] [US1] Add
      `libs/frontend/shared-ui/src/lib/dynamic-outlet/dynamic-outlet.component.spec.ts` covering:
      renders nothing before the loader resolves, renders the resolved component after
- [ ] T006 [US1] Export `DynamicOutletComponent` from `libs/frontend/shared-ui/src/index.ts`
- [ ] T007 [US1] Create `apps/frontend/src/app/dashboard/dashboard-widgets.registry.ts` exporting
      `DASHBOARD_WIDGET_CONTRIBUTIONS: DashboardWidgetContribution[]` with one entry:
      `{ domainId: 'holdings', loadComponent: () => import('@vaultfolio/frontend-domain-holdings').then(m => m.HoldingsDistributionComponent) }`
      (contracts/dashboard-settings-extension-points.md)
- [ ] T008 [US1] Update `apps/frontend/src/app/dashboard/dashboard.component.ts`: remove the direct
      `HoldingsDistributionComponent` import and its `@nx/enforce-module-boundaries` eslint-disable
      comment; add a `visibleWidgets = computed(...)` that filters `DASHBOARD_WIDGET_CONTRIBUTIONS`
      by `isDomainEntitled(currentUser, w.domainId)` (import `isDomainEntitled` from
      `@vaultfolio/frontend-domain-access`)
- [ ] T009 [US1] Update `apps/frontend/src/app/dashboard/dashboard.component.html`: replace the
      hard-coded `@defer (on immediate) { <app-holdings-distribution ... /> }` block inside the
      "Allocation" `p-card` with
      `@for (widget of visibleWidgets(); track widget.domainId) { <app-dynamic-outlet [loader]="widget.loadComponent" /> }`,
      importing `DynamicOutletComponent` into the component's `imports` array
- [ ] T010 [US1] Update `apps/frontend/src/app/dashboard/dashboard.component.spec.ts`: cover the
      Holdings widget appearing for an entitled user and disappearing for an unentitled one, and
      the other Dashboard cards still rendering without error when no widget is visible (Acceptance
      Scenarios 1, 2, 4)
- [ ] T011 [US1] Follow quickstart.md §1's throwaway-domain steps to validate Acceptance Scenario 3
      / SC-001 manually (add a scratch `scope:frontend-domain` library + one
      `DASHBOARD_WIDGET_CONTRIBUTIONS` entry, confirm entitlement-gated visibility, then remove the
      scratch library — no code left behind)

**Checkpoint**: Dashboard widget contribution mechanism works end-to-end; Holdings' widget behaves
exactly as before.

---

## Phase 4: User Story 2 - A domain's settings contribution moves with the domain (Priority: P1)

**Goal**: Settings shows the standard Profile/Preferences tabs to every signed-in user, plus one
additional entitlement-gated tab per domain that contributes one, using the same `domainGuard`/
`isDomainEntitled` mechanism as a domain's main route (FR-002, FR-004, FR-006).

**Independent Test**: Confirm Profile/Preferences remain available to every signed-in user; add a
throwaway domain with its own settings tab and confirm it appears only for an entitled user,
navigates correctly, and is denied on direct URL visit when not entitled (quickstart.md §2).

### Implementation for User Story 2

- [ ] T012 [P] [US2] Add `SettingsTabContribution` interface (`domainId: string`, `path: string`,
      `labelKey: string`, `loadComponent: () => Promise<Type<unknown>>`) in
      `libs/frontend/domain-access/src/lib/settings-tab-contribution.ts`
      (contracts/dashboard-settings-extension-points.md)
- [ ] T013 [US2] Export `SettingsTabContribution` as a type-only export from
      `libs/frontend/domain-access/src/index.ts`
- [ ] T014 [US2] Create `apps/frontend/src/app/settings/settings-tabs.registry.ts` exporting
      `SETTINGS_TAB_CONTRIBUTIONS: SettingsTabContribution[] = []` (empty for this spec — mechanism
      only, per data-model.md/Assumptions)
- [ ] T015 [US2] Update `apps/frontend/src/app/settings/settings.component.ts`: add a
      `visibleTabs = computed(...)` filtering `SETTINGS_TAB_CONTRIBUTIONS` by
      `isDomainEntitled(currentUser, c.domainId)` (same computation style as
      `AppSidebarComponent`'s `APPLICATION_AREAS` filter), alongside the existing fixed
      profile/preferences tab list
- [ ] T016 [US2] Update `apps/frontend/src/app/settings/settings.component.html`: render one
      `<p-tab [value]="tab.path">{{ tab.labelKey | translate }}</p-tab>` per entry in
      `visibleTabs()` after the existing Profile/Preferences `p-tab`s
- [ ] T017 [US2] Update `apps/frontend/src/app/app.routes.ts`'s `settings` route `children` array:
      spread `...SETTINGS_TAB_CONTRIBUTIONS.map(c => ({ path: c.path, canActivate: [domainGuard(c.domainId)], loadComponent: c.loadComponent }))`
      after the existing `profile`/`preferences` children (contracts/routes.md "Settings (US2)")
- [ ] T018 [US2] Update `apps/frontend/src/app/settings/settings.component.spec.ts`: cover Profile
      and Preferences always present regardless of entitlements (Acceptance Scenario 1), a
      contributed tab shown only when entitled (Scenarios 2, 3), and no extra tab when a domain
      contributes none (Scenario 5)
- [ ] T019 [US2] Follow quickstart.md §2's throwaway-domain steps to validate Acceptance Scenario 4
      manually (visit a contributed tab's URL directly while not entitled; confirm the same
      `domainGuard` redirect a domain's main route already produces) — remove the scratch
      contribution afterward

**Checkpoint**: Settings tab contribution mechanism works end-to-end; Profile/Preferences remain
unaffected; holdings (which contributes no settings tab per Assumptions) adds no extra tab.

---

## Phase 5: User Story 3 - Imports lives inside Holdings, not as its own navigation item (Priority: P2)

**Goal**: "Imports" becomes an internal tab of the Holdings area instead of a standalone nav
entry/route, governed by the same `domainGuard('holdings')` as the rest of Holdings, with the
pre-change `/imports` and `/app/imports` addresses still resolving via redirect (FR-008–FR-011).

**Independent Test**: Confirm the standalone "Imports" nav entry/route are gone and the same import
functionality is reachable as a tab inside Holdings, for a holdings-entitled user; confirm the
legacy addresses still redirect correctly (quickstart.md §3).

### Implementation for User Story 3

- [ ] T020 [US3] Move `apps/frontend/src/app/imports/imports.component.ts`,
      `imports.component.html`, `imports.component.css` unchanged into
      `libs/frontend/domain/holdings/src/lib/imports/` (same file names); delete the old
      `apps/frontend/src/app/imports/` directory
- [ ] T021 [US3] Export `ImportsComponent` from `libs/frontend/domain/holdings/src/index.ts`
- [ ] T022 [US3] Create `HoldingsAreaComponent` (tabs container: `p-tabs` + `router-outlet`,
      `activeTab`/`onTabChange` mirroring `SettingsComponent`/`AdminComponent`'s existing pattern —
      research.md #5) in
      `libs/frontend/domain/holdings/src/lib/holdings-area/holdings-area.component.ts` +
      `.html`/`.css`, with tabs `list` (default) and `imports`
- [ ] T023 [P] [US3] Add `holdings-area.component.spec.ts` in the same directory covering
      tab-switching/active-tab detection from the route (mirroring
      `settings.component.spec.ts`'s existing pattern per plan.md Principle IV)
- [ ] T024 [US3] Export `HoldingsAreaComponent` from `libs/frontend/domain/holdings/src/index.ts`
- [ ] T025 [US3] Update `apps/frontend/src/app/app.routes.ts`'s `app/holdings` route: change
      `loadComponent` to `HoldingsAreaComponent`, keep `canActivate: [domainGuard('holdings')]` on
      this parent only, add `children`: `{ path: '', pathMatch: 'full', redirectTo: 'list' }`,
      `{ path: 'list', ... HoldingsComponent }` (existing list/distribution page unchanged),
      `{ path: 'imports', ... }` → the relocated `ImportsComponent`; remove the standalone
      `app/imports` child route entirely (contracts/routes.md "Holdings (US3)")
- [ ] T026 [US3] Update the legacy redirects in `apps/frontend/src/app/app.routes.ts`: change
      `{ path: 'imports', ... }` to `redirectTo: 'app/holdings/imports'`, and add a new redirect
      entry `{ path: 'imports', pathMatch: 'full', redirectTo: 'holdings/imports' }` as a child of
      the `app` route (contracts/routes.md "Legacy redirects (updated)", FR-010)
- [ ] T027 [US3] Remove the `{ id: 'imports', ... }` entry from
      `apps/frontend/src/app/core/layout/application-areas.ts` (FR-009, SC-004)
- [ ] T028 [P] [US3] Update `apps/frontend/src/app/core/layout/app-sidebar/*.spec.ts` (and any
      other spec asserting on `APPLICATION_AREAS`'s nav entries) to no longer expect a standalone
      "Imports" entry
- [ ] T029 [US3] Update/verify `libs/frontend/domain/holdings/src/lib/holdings.component.spec.ts`
      and any route-level test still passes unchanged now that `HoldingsComponent` is reached via
      `app/holdings/list` rather than directly at `app/holdings`
- [ ] T030 [US3] Follow quickstart.md §3 to validate end-to-end: nav shows only "Holdings" for a
      holdings-entitled user, the Imports tab works inside Holdings, an unentitled user is denied
      both the nav entry and a direct `/app/holdings/imports` visit, and both `/imports` and
      `/app/imports` land on `/app/holdings/imports` (Acceptance Scenarios 1–4, SC-006)

**Checkpoint**: Imports has no standalone nav entry/route; it's a fully working tab inside Holdings;
legacy bookmarks still resolve.

---

## Phase 6: User Story 4 - Verwaltung (Admin) is a clearly separate concern from product domains (Priority: P3)

**Goal**: Admin's code is relocated, file-for-file, into a new `libs/frontend/admin` Nx library
tagged `scope:frontend-admin` (structurally distinct from `scope:frontend-domain`), with role-based
access control unchanged (FR-012–FR-014).

**Independent Test**: Confirm every existing Admin flow (Accounts, Sign-ups, Invitations, General)
works unchanged for an Administrator, a non-Administrator is still denied, and Admin's code is
structurally distinct from both the app-shell and any product-domain library (quickstart.md §4).

### Implementation for User Story 4

- [ ] T031 [US4] Scaffold the new library `libs/frontend/admin` (`@vaultfolio/frontend-admin`):
      `package.json` with `"nx": { "tags": ["scope:frontend-admin"] }`, `main`/`types`
      `./src/index.ts`, and `exports` restricted to `"."` and `"./package.json"` only — mirroring
      `libs/frontend/domain/holdings/package.json`'s existing convention
      (contracts/module-boundaries.md guarantee 3)
- [ ] T032 [US4] Move `apps/frontend/src/app/admin/admin.component.ts/.html/.css`,
      `admin/accounts/**`, `admin/signups/**`, `admin/invitations/**`, `admin/health-status/**`
      (including their existing spec files, e.g. `health-status.component.spec.ts`) unchanged into
      `libs/frontend/admin/src/lib/`; delete the old `apps/frontend/src/app/admin/` directory
- [ ] T033 [US4] Create `libs/frontend/admin/src/index.ts` exporting `AdminComponent` as the
      library's public entry point (contracts/module-boundaries.md)
- [ ] T034 [US4] Add the `scope:frontend-admin` tag's `depConstraints` entry to
      [eslint.config.mjs](../../eslint.config.mjs): `{ sourceTag: 'scope:frontend-admin', onlyDependOnLibsWithTags: ['scope:shared'] }`,
      and add `'scope:frontend-admin'` to the existing `scope:frontend` entry's
      `onlyDependOnLibsWithTags` array (contracts/module-boundaries.md "depConstraints additions")
- [ ] T035 [US4] Update `apps/frontend/src/app/app.routes.ts`'s `app/admin` route and its children
      (`accounts`, `signups`, `invitations`, `general`) to `loadComponent` from
      `@vaultfolio/frontend-admin` instead of `./admin/...`; keep `canActivate: [adminGuard]`,
      paths, and titles unchanged (contracts/routes.md "Admin (US4)")
- [ ] T036 [P] [US4] Verify `apps/frontend/src/app/auth/admin.guard.ts` needs no code change
      (still role-based, `role === 'ADMIN'`, per FR-013) and add/keep its existing spec passing
      unchanged
- [ ] T037 [US4] Confirm the root `package.json` workspace glob `libs/frontend/*` already covers
      the new `libs/frontend/admin` project without modification (plan.md Structure Decision) —
      verification only, no file change expected
- [ ] T038 [US4] Run `npx nx run-many -t lint` and confirm a deliberate cross-import (e.g.
      temporarily importing something from `libs/frontend/admin` inside
      `libs/frontend/domain/holdings`, then reverting) fails with an
      `@nx/enforce-module-boundaries` error, proving the new boundary is enforced
      (contracts/module-boundaries.md "Verification")
- [ ] T039 [US4] Inspect `libs/frontend/admin/package.json`'s `nx.tags` and confirm it reads
      `scope:frontend-admin`, distinct from every `libs/frontend/domain/*` library's
      `scope:frontend-domain` (Acceptance Scenario 3)
- [ ] T040 [US4] Follow quickstart.md §4 to validate end-to-end: every Admin flow works unchanged
      for an Administrator (SC-003), a non-Administrator is denied in nav and on direct
      `/app/admin` visit exactly as before (Acceptance Scenario 2)

**Checkpoint**: Admin is a structurally distinct, independently-tagged library; every existing
Admin flow and access rule is unchanged.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Full regression sweep across all four stories, per quickstart.md §5.

- [ ] T041 Run `npm exec nx run-many -t test` and confirm all existing Holdings
      (view/create/edit/delete/import/distribution — SC-002) and Admin (Accounts/Sign-ups/
      Invitations/General — SC-003) tests pass unchanged after the relocations in US3/US4
- [ ] T042 Run `npm exec nx run-many -t lint` workspace-wide and confirm it is clean, including the
      new `scope:frontend-admin` boundary (contracts/module-boundaries.md) and the removed
      `imports` nav entry (`application-areas.ts`)
- [ ] T043 Re-walk quickstart.md sections 1–4 end-to-end in one pass (Dashboard widget, Settings
      tab, Imports-in-Holdings, Admin module) to confirm no cross-story regression was introduced by
      later tasks touching shared files (`app.routes.ts`, `application-areas.ts`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: None required — skip directly to user stories.
- **User Stories (Phases 3–6)**: Each depends only on Setup (Phase 1). All four are independent of
  one another per plan.md/research.md and may proceed in parallel or in priority order (US1/US2 →
  US3 → US4).
- **Polish (Phase 7)**: Depends on all four user stories being complete (it is a regression sweep
  across all of them).

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on US2/US3/US4. Touches `domain-access`, `shared-ui`,
  `apps/frontend/src/app/dashboard/**`.
- **User Story 2 (P1)**: No dependency on US1/US3/US4, though it touches the same
  `app.routes.ts`'s `settings` node US1 does not — no file overlap with US1.
- **User Story 3 (P2)**: No dependency on US1/US2/US4. Touches
  `libs/frontend/domain/holdings/**`, `app.routes.ts`'s `holdings` node, `application-areas.ts`.
- **User Story 4 (P3)**: No dependency on US1/US2/US3. Touches `libs/frontend/admin` (new),
  `app.routes.ts`'s `admin` node, `eslint.config.mjs`.
- **Shared-file caution**: US2, US3, and US4 each edit a different, non-overlapping node of
  `apps/frontend/src/app/app.routes.ts` (`settings`, `holdings`, `admin` respectively) — safe to
  parallelize across developers, but avoid two people editing that one file simultaneously without
  coordinating the merge.

### Within Each User Story

- Type/interface additions before the registry/component that consumes them.
- New shared/domain-library components before the `app.routes.ts`/registry wiring that references
  them.
- Route/registry wiring before the manual quickstart validation task that exercises it.

### Parallel Opportunities

- T002, T004, T005 (US1) touch different files with no dependency on each other — parallelizable.
- T012 (US2) is independent of every US1 task — the two P1 stories can be staffed in parallel.
- T023, T028, T036 are marked [P] — each is an isolated spec/verification file with no dependency
  on other same-story tasks completing first.
- Different user story phases (3–6) can be worked on in parallel by different team members once
  Phase 1 (Setup) is done.

---

## Parallel Example: User Story 1

```bash
# Launch independent US1 file-creation tasks together:
Task: "Add DashboardWidgetContribution interface in libs/frontend/domain-access/src/lib/dashboard-widget-contribution.ts"
Task: "Create DynamicOutletComponent in libs/frontend/shared-ui/src/lib/dynamic-outlet/dynamic-outlet.component.ts"
Task: "Add dynamic-outlet.component.spec.ts in libs/frontend/shared-ui/src/lib/dynamic-outlet/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 1 (Dashboard widget contribution) — the highest-value, highest-risk
   story per spec.md's "Why this priority", and the pattern every other extension point mirrors.
3. **STOP and VALIDATE**: Run quickstart.md §1 independently.
4. Deploy/demo if ready — Holdings' distribution widget behaves unchanged, and the pattern is
   proven for future domains.

### Incremental Delivery

1. Setup → baseline confirmed.
2. Add User Story 1 (Dashboard widget) → validate independently → demo (MVP!).
3. Add User Story 2 (Settings tab) → validate independently → demo (both P1 stories done).
4. Add User Story 3 (Imports → Holdings tab) → validate independently → demo.
5. Add User Story 4 (Admin → own library) → validate independently → demo.
6. Polish: full regression sweep (Phase 7).

### Parallel Team Strategy

With multiple developers, once Setup is done:

- Developer A: User Story 1 (Dashboard widget contribution)
- Developer B: User Story 2 (Settings tab contribution)
- Developer C: User Story 3 (Imports relocation)
- Developer D: User Story 4 (Admin library extraction)

Each story is independently completable and testable; only `app.routes.ts` is a shared file to
coordinate merges on (each story edits a distinct, non-overlapping route node).

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Each user story should be independently completable and testable — no story depends on another
  being done first.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
- No new backend/database entity or contract change is introduced by this feature (data-model.md) —
  every task above is frontend-only.
