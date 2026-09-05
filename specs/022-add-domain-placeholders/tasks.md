---
description: 'Task list template for feature implementation'
---

# Tasks: Placeholder Domains for the Multi-Domain Pivot

**Input**: Design documents from `/specs/022-add-domain-placeholders/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/domain-placeholder-library.md, contracts/registry-additions.md, quickstart.md

**Tests**: Included per plan.md's "implement-then-test" practice (unit tests for each placeholder
component and the route/registry wiring) — not TDD, but not skipped either, matching the workspace
norm and Constitution Principle III/IV.

**Organization**: Tasks are grouped by user story (spec.md). Each of the five new domains
(`retirement`, `insurances`, `haushaltsplaner`, `historic-wealth-development`, `account-overview`)
is scaffolded identically per contracts/domain-placeholder-library.md, so the five domains' library
tasks appear together within User Story 1 and are parallelizable across domains (different
directories) but not within a domain's own file set (component before its spec/export).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Nx monorepo: `libs/frontend/domain/<id>/` (one new `scope:frontend-domain` library per domain),
`libs/frontend/domain-access/` (`DOMAIN_REGISTRY`), `apps/frontend/src/app/` (route table,
`APPLICATION_AREAS`), `apps/backend/src/accounts/` (`KNOWN_DOMAIN_IDS`),
`libs/frontend/shared-ui/src/lib/` (icon map, i18n dictionaries) — per plan.md Project Structure.

---

## Phase 1: Setup

No new dependency, tool, or project-wide configuration is introduced (plan.md Technical
Context — "No new dependency is introduced"). Setup is folded into Phase 2, below.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one piece of shared infrastructure every new domain's `DomainDescriptor` and
`ApplicationArea` entry depends on before it can reference a valid icon.

**⚠️ CRITICAL**: Must complete before any User Story 1 registry task (T009-T012) runs, since those
entries reference these icon names; the five per-domain library tasks (T001-T008) do not depend on
this and may proceed in parallel with it.

- [x] T001 [P] Add the three missing `vf-icon` semantic names this feature needs — `elderly`,
      `receipt-long`, `account-balance` — to `ICON_NAME_MAP` in
      `libs/frontend/shared-ui/src/lib/icon/icon-name.map.ts` (research.md #2; `shield` and
      `trending-up` already exist and need no change)

**Checkpoint**: Icon map ready — User Story 1's registry wiring (T009, T010) can now proceed.

---

## Phase 3: User Story 1 - A new domain is visible, reachable, and gated like Holdings (Priority: P1) 🎯 MVP

**Goal**: Each of the five new domains has its own `scope:frontend-domain` library exposing one
placeholder component, is appended to `DOMAIN_REGISTRY`/`APPLICATION_AREAS`/`app.routes.ts`, and is
allow-listed backend-side, so an entitled user sees the nav entry and reaches the placeholder page,
while an unentitled user sees neither (FR-001 through FR-004, FR-006, FR-007).

**Independent Test**: Grant a test user entitlement to one new domain; confirm its nav entry and
placeholder page appear and open correctly; confirm the other four new domains and Holdings are
unaffected (quickstart.md §1-2, §4).

### Domain library: retirement

- [x] T002 [P] [US1] Scaffold the `@vaultfolio/frontend-domain-retirement` library
      (`project.json` tagged `scope:frontend-domain`, `package.json`, `tsconfig.json`,
      `tsconfig.lib.json`, `tsconfig.spec.json`) in `libs/frontend/domain/retirement/`, mirroring
      `libs/frontend/domain/holdings`'s existing shape (contracts/domain-placeholder-library.md
      "Project shape")
- [x] T003 [US1] Implement `RetirementPlaceholderComponent` (standalone Angular component,
      renders the domain name via `nav.retirement`/`retirementPlaceholder.title` and a
      `retirementPlaceholder.body` "not yet available" message, no inputs, no backend call) in
      `libs/frontend/domain/retirement/src/lib/retirement-placeholder/retirement-placeholder.component.ts`
      (contracts/domain-placeholder-library.md "Component contract", depends on T002)
- [x] T004 [US1] Add a unit test for `RetirementPlaceholderComponent` (renders the domain name and
      "not yet available" copy) in
      `libs/frontend/domain/retirement/src/lib/retirement-placeholder/retirement-placeholder.component.spec.ts`
      (depends on T003)
- [x] T005 [US1] Export `RetirementPlaceholderComponent` (only symbol) from
      `libs/frontend/domain/retirement/src/index.ts` (contracts/domain-placeholder-library.md
      "Public API", depends on T003)

### Domain library: insurances

- [x] T006 [P] [US1] Scaffold the `@vaultfolio/frontend-domain-insurances` library
      (`project.json` tagged `scope:frontend-domain`, `package.json`, `tsconfig.json`,
      `tsconfig.lib.json`, `tsconfig.spec.json`) in `libs/frontend/domain/insurances/`, mirroring
      `libs/frontend/domain/holdings`'s existing shape
- [x] T007 [US1] Implement `InsurancesPlaceholderComponent` (standalone Angular component,
      renders the domain name via `nav.insurances`/`insurancesPlaceholder.title` and an
      `insurancesPlaceholder.body` "not yet available" message, no inputs, no backend call) in
      `libs/frontend/domain/insurances/src/lib/insurances-placeholder/insurances-placeholder.component.ts`
      (depends on T006)
- [x] T008 [US1] Add a unit test for `InsurancesPlaceholderComponent` (renders the domain name and
      "not yet available" copy) in
      `libs/frontend/domain/insurances/src/lib/insurances-placeholder/insurances-placeholder.component.spec.ts`
      (depends on T007)
- [x] T009 [US1] Export `InsurancesPlaceholderComponent` (only symbol) from
      `libs/frontend/domain/insurances/src/index.ts` (depends on T007)

### Domain library: haushaltsplaner

- [x] T010 [P] [US1] Scaffold the `@vaultfolio/frontend-domain-haushaltsplaner` library
      (`project.json` tagged `scope:frontend-domain`, `package.json`, `tsconfig.json`,
      `tsconfig.lib.json`, `tsconfig.spec.json`) in `libs/frontend/domain/haushaltsplaner/`,
      mirroring `libs/frontend/domain/holdings`'s existing shape
- [x] T011 [US1] Implement `HaushaltsplanerPlaceholderComponent` (standalone Angular component,
      renders the domain name via `nav.haushaltsplaner`/`haushaltsplanerPlaceholder.title` and a
      `haushaltsplanerPlaceholder.body` "not yet available" message, no inputs, no backend call) in
      `libs/frontend/domain/haushaltsplaner/src/lib/haushaltsplaner-placeholder/haushaltsplaner-placeholder.component.ts`
      (depends on T010)
- [x] T012 [US1] Add a unit test for `HaushaltsplanerPlaceholderComponent` (renders the domain
      name and "not yet available" copy) in
      `libs/frontend/domain/haushaltsplaner/src/lib/haushaltsplaner-placeholder/haushaltsplaner-placeholder.component.spec.ts`
      (depends on T011)
- [x] T013 [US1] Export `HaushaltsplanerPlaceholderComponent` (only symbol) from
      `libs/frontend/domain/haushaltsplaner/src/index.ts` (depends on T011)

### Domain library: historic-wealth-development

- [x] T014 [P] [US1] Scaffold the `@vaultfolio/frontend-domain-historic-wealth-development`
      library (`project.json` tagged `scope:frontend-domain`, `package.json`, `tsconfig.json`,
      `tsconfig.lib.json`, `tsconfig.spec.json`) in
      `libs/frontend/domain/historic-wealth-development/`, mirroring
      `libs/frontend/domain/holdings`'s existing shape
- [x] T015 [US1] Implement `HistoricWealthDevelopmentPlaceholderComponent` (standalone Angular
      component, renders the domain name via
      `nav.historicWealthDevelopment`/`historicWealthDevelopmentPlaceholder.title` and a
      `historicWealthDevelopmentPlaceholder.body` "not yet available" message, no inputs, no
      backend call) in
      `libs/frontend/domain/historic-wealth-development/src/lib/historic-wealth-development-placeholder/historic-wealth-development-placeholder.component.ts`
      (depends on T014)
- [x] T016 [US1] Add a unit test for `HistoricWealthDevelopmentPlaceholderComponent` (renders the
      domain name and "not yet available" copy) in
      `libs/frontend/domain/historic-wealth-development/src/lib/historic-wealth-development-placeholder/historic-wealth-development-placeholder.component.spec.ts`
      (depends on T015)
- [x] T017 [US1] Export `HistoricWealthDevelopmentPlaceholderComponent` (only symbol) from
      `libs/frontend/domain/historic-wealth-development/src/index.ts` (depends on T015)

### Domain library: account-overview

- [x] T018 [P] [US1] Scaffold the `@vaultfolio/frontend-domain-account-overview` library
      (`project.json` tagged `scope:frontend-domain`, `package.json`, `tsconfig.json`,
      `tsconfig.lib.json`, `tsconfig.spec.json`) in `libs/frontend/domain/account-overview/`,
      mirroring `libs/frontend/domain/holdings`'s existing shape
- [x] T019 [US1] Implement `AccountOverviewPlaceholderComponent` (standalone Angular component,
      renders the domain name via `nav.accountOverview`/`accountOverviewPlaceholder.title` and an
      `accountOverviewPlaceholder.body` "not yet available" message, no inputs, no backend call) in
      `libs/frontend/domain/account-overview/src/lib/account-overview-placeholder/account-overview-placeholder.component.ts`
      (depends on T018)
- [x] T020 [US1] Add a unit test for `AccountOverviewPlaceholderComponent` (renders the domain
      name and "not yet available" copy) in
      `libs/frontend/domain/account-overview/src/lib/account-overview-placeholder/account-overview-placeholder.component.spec.ts`
      (depends on T019)
- [x] T021 [US1] Export `AccountOverviewPlaceholderComponent` (only symbol) from
      `libs/frontend/domain/account-overview/src/index.ts` (depends on T019)

### i18n

- [x] T022 [P] [US1] Add `nav.retirement`, `nav.insurances`, `nav.haushaltsplaner`,
      `nav.historicWealthDevelopment`, `nav.accountOverview` nav labels, and
      `retirementPlaceholder.{title,body}`, `insurancesPlaceholder.{title,body}`,
      `haushaltsplanerPlaceholder.{title,body}`,
      `historicWealthDevelopmentPlaceholder.{title,body}`,
      `accountOverviewPlaceholder.{title,body}` keys (English copy) to
      `libs/frontend/shared-ui/src/lib/i18n/translations/en.ts` (research.md #4)
- [x] T023 [P] [US1] Add the same ten nav keys and ten placeholder keys (German copy) to
      `libs/frontend/shared-ui/src/lib/i18n/translations/de.ts`, matching `en.ts`'s key shape
      (FR-011 of 020's i18n contract — `de.ts` is validated against `en.ts`'s shape)

### Registry wiring

- [x] T024 [US1] Append five `DomainDescriptor` entries (`retirement`/`elderly`,
      `insurances`/`shield`, `haushaltsplaner`/`receipt-long`,
      `historic-wealth-development`/`trending-up`, `account-overview`/`account-balance`, each with
      its `nav.<id>` `labelKey` and `path` equal to `id`) to `DOMAIN_REGISTRY` in
      `libs/frontend/domain-access/src/lib/domain-registry.ts`, after the existing `holdings`
      entry, in the order given in contracts/registry-additions.md §1 (depends on T001)
- [x] T025 [US1] Append five `ApplicationArea` entries (matching ids/paths/icons from T024, each
      with `domainId` set to its own id) to `APPLICATION_AREAS` in
      `apps/frontend/src/app/core/layout/application-areas.ts`, inserted after the existing
      `holdings` area and before `settings` (contracts/registry-additions.md §2, depends on T001)
- [x] T026 [US1] Add five sibling route objects (`retirement`, `insurances`, `haushaltsplaner`,
      `historic-wealth-development`, `account-overview`) to the `app` route's `children` in
      `apps/frontend/src/app/app.routes.ts`, each guarded by `domainGuard('<id>')` and
      lazy-loading its placeholder component via `loadComponent`, alongside the existing
      `holdings` block (contracts/registry-additions.md §3, depends on T005, T009, T013, T017,
      T021)
- [x] T027 [US1] Add the five new ids (`retirement`, `insurances`, `haushaltsplaner`,
      `historic-wealth-development`, `account-overview`) to the `KNOWN_DOMAIN_IDS` set in
      `apps/backend/src/accounts/accounts.service.ts`, alongside `'holdings'`
      (contracts/registry-additions.md §4)

### Regression tests for User Story 1

- [x] T028 [US1] Extend `apps/frontend/src/app/app.routes.spec.ts` with cases covering all five
      new domains: an entitled user resolves `/app/<id>` to its placeholder route, and a user
      without that domain's entitlement is redirected to `/app/dashboard` the same way an
      unentitled Holdings visit is today (depends on T026)
- [x] T029 [US1] Extend `apps/backend/src/accounts/accounts.controller.spec.ts` (and/or
      `accounts.service.spec.ts`) to confirm `PATCH /accounts/:id/domain-scopes` now accepts each
      of the five new ids (200, previously `invalid_domain`) and still rejects an unknown id
      (depends on T027)

**Checkpoint**: At this point, User Story 1 is fully functional and independently testable — all
five domains are registered, navigable, and entitlement-gated.

---

## Phase 4: User Story 2 - Dashboard and Settings stay intact with domains that contribute nothing yet (Priority: P2)

**Goal**: Confirm the Dashboard and Settings screens render exactly as they do today for a user
entitled to any of the five new domains — no widget, tab, error, or empty gap attributable to them
(FR-005).

**Independent Test**: Entitle a test user to one or more of the five new domains; confirm their
Dashboard and Settings screens render exactly as they would with only Holdings entitlement, with
no errors, empty widget slots, or empty tabs (quickstart.md §3).

- [x] T030 [US2] Add a regression test asserting `DASHBOARD_WIDGET_CONTRIBUTIONS` in
      `apps/frontend/src/app/dashboard/dashboard-widgets.registry.ts` contains no entry whose
      `domainId` is one of the five new ids (only `holdings`), locking in FR-005 (depends on T024
      for the ids to assert against)
- [x] T031 [US2] Add a regression test asserting `SETTINGS_TAB_CONTRIBUTIONS` in
      `apps/frontend/src/app/settings/settings-tabs.registry.ts` contains no entry whose
      `domainId` is one of the five new ids, locking in FR-005 (depends on T024)
- [x] T032 [P] [US2] Extend the Dashboard component's existing rendering test (e.g.
      `apps/frontend/src/app/dashboard/dashboard.component.spec.ts` if present, else add one) to
      cover a user entitled to one of the five new domains and no other domain: only the
      non-domain-specific Dashboard content renders, no error or empty widget slot
- [x] T033 [P] [US2] Extend the Settings component's existing rendering test (e.g.
      `apps/frontend/src/app/settings/settings.component.spec.ts` if present, else add one) to
      cover a user entitled to one of the five new domains and no other domain: only
      Profile/Preferences tabs render, no error or empty tab

**Checkpoint**: User Stories 1 AND 2 both work independently — Dashboard/Settings are proven
unaffected by the five new domains existing.

---

## Phase 5: User Story 3 - Administrators can grant access to each new domain individually (Priority: P3)

**Goal**: Confirm an administrator can grant/revoke any one of the five new domains for a specific
user independently of their other entitlements, and that admin accounts have all five by default
(FR-008, FR-009, FR-010).

**Independent Test**: As an administrator, grant one new domain to a test user; confirm they gain
exactly that domain's nav entry and access; revoke it and confirm access is removed with no effect
on other entitlements (quickstart.md §2, §4).

- [x] T034 [US3] Extend the admin accounts screen's existing domain-scope-checkbox test (e.g.
      `libs/frontend/admin/src/lib/accounts/accounts.component.spec.ts` — locate via existing
      Holdings domain-scope test) to confirm the five new domains each appear as an independently
      togglable checkbox, sourced from `DOMAIN_REGISTRY` with no new admin-UI code (depends on
      T024)
- [x] T035 [US3] Add a regression test confirming granting/revoking one of the five new domain
      scopes via `PATCH /accounts/:id/domain-scopes` does not add or remove any other id already
      present in that account's `domainScopes` (FR-010), in
      `apps/backend/src/accounts/accounts.service.spec.ts` (depends on T027)
- [x] T036 [US3] Add a regression test confirming an ADMIN-role `SessionUser`/`AccountSummary` is
      treated as entitled to all five new domains by default (mirroring the existing Holdings
      `isDomainEntitled` ADMIN-bypass test) in
      `libs/frontend/domain-access/src/lib/is-domain-entitled.spec.ts` (depends on T024)

**Checkpoint**: All user stories are independently functional — domains are registered,
Dashboard/Settings are unaffected, and per-user/per-domain admin entitlement management works.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation that spans all three stories.

- [x] T037 Run `npm exec nx affected -t lint test build` and confirm every new
      `scope:frontend-domain` library passes the existing `scope:frontend-domain` → `scope:shared`
      ESLint boundary rule with no new rule needed (quickstart.md §5)
- [x] T038 Walk through quickstart.md end-to-end (all five domains) to confirm SC-001 through
      SC-005 and FR-006/FR-009 hold

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — icon map addition, can start immediately. Blocks
  only T024/T025 (registry entries referencing the new icon names).
- **User Story 1 (Phase 3)**: The five domain-library task groups (T002-T021) and the i18n tasks
  (T022-T023) have no dependency on Phase 2 and can start immediately in parallel. T024/T025
  depend on Phase 2 (T001). T026 depends on all five libraries' `index.ts` exports (T005, T009,
  T013, T017, T021). T027 is independent of everything else in this phase. T028/T029 depend on
  T026/T027 respectively.
- **User Story 2 (Phase 4)**: Depends on User Story 1's registry entries (T024) existing, so the
  "no entry added" assertions have real ids to check against.
- **User Story 3 (Phase 5)**: Depends on User Story 1's registry entries (T024) and backend
  allow-list (T027).
- **Polish (Phase 6)**: Depends on all of Phases 2-5 being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories — the MVP.
- **User Story 2 (P2)**: Depends on User Story 1 (domains must be registered before their absence
  from Dashboard/Settings can be asserted) — matches spec.md's own stated dependency.
- **User Story 3 (P3)**: Depends on User Story 1 (domains must exist before entitlement to them
  can be granted/revoked); independent of User Story 2.

### Within Each User Story

- Within each domain-library group: scaffold (T002/T006/T010/T014/T018) → component
  (T003/T007/T011/T015/T019) → spec + index export (parallel with each other, both depend on the
  component).
- Registry wiring (T024-T027) depends on the library groups' index exports and the icon map, not
  on each other.

### Parallel Opportunities

- T001 (Foundational) can run in parallel with all of T002-T023 (Phase 3 library/i18n tasks).
- All five domain-library scaffold tasks (T002, T006, T010, T014, T018) can run in parallel with
  each other (different directories).
- T022 and T023 (en.ts/de.ts) can run in parallel with each other and with the library tasks.
- T032 and T033 (Phase 4) can run in parallel with each other.
- Different user story phases (3, 4, 5) can be staffed in parallel once their stated dependencies
  are met.

---

## Parallel Example: User Story 1 domain-library scaffolding

```bash
# Launch all five domain scaffolds together:
Task: "Scaffold @vaultfolio/frontend-domain-retirement library in libs/frontend/domain/retirement/"
Task: "Scaffold @vaultfolio/frontend-domain-insurances library in libs/frontend/domain/insurances/"
Task: "Scaffold @vaultfolio/frontend-domain-haushaltsplaner library in libs/frontend/domain/haushaltsplaner/"
Task: "Scaffold @vaultfolio/frontend-domain-historic-wealth-development library in libs/frontend/domain/historic-wealth-development/"
Task: "Scaffold @vaultfolio/frontend-domain-account-overview library in libs/frontend/domain/account-overview/"

# Launch the two i18n dictionary edits together:
Task: "Add nav + placeholder keys (English) to libs/frontend/shared-ui/src/lib/i18n/translations/en.ts"
Task: "Add nav + placeholder keys (German) to libs/frontend/shared-ui/src/lib/i18n/translations/de.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (icon map — trivial, ~1 line change)
2. Complete Phase 3: User Story 1 (all five domains registered, navigable, gated)
3. **STOP and VALIDATE**: Run quickstart.md §1-2, §4 for all five domains
4. Deploy/demo if ready — this alone satisfies SC-001, SC-002, SC-004

### Incremental Delivery

1. Foundational → five domain libraries + registries wired (MVP!)
2. Add User Story 2 → Dashboard/Settings regression tests → confirms FR-005/SC-005
3. Add User Story 3 → admin grant/revoke regression tests → confirms FR-008/FR-009/FR-010/SC-003
4. Polish → full quickstart.md walkthrough + `nx affected` run

### Parallel Team Strategy

With multiple developers, after Phase 2 (trivial, ~5 minutes):

- Developer A: `retirement` + `insurances` library groups (T002-T009)
- Developer B: `haushaltsplaner` + `historic-wealth-development` library groups (T010-T017)
- Developer C: `account-overview` library group (T018-T021) + i18n (T022-T023)
- Whoever finishes first does the registry wiring (T024-T027, sequential — same shared files)
- Then User Story 2 and User Story 3 phases can be split across two developers in parallel
