---
description: 'Task list template for feature implementation'
---

# Tasks: Account Overview

**Input**: Design documents from `/specs/025-account-overview/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/account-overview-api.md, quickstart.md

**Tests**: Included — plan.md's Constitution Check (Principle III/IV) commits to domain-lib
validation unit tests, controller/repository unit tests, and an e2e-spec, mirroring `holdings`.

**Organization**: Tasks are grouped by user story (spec.md's US1/US2/US3) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Nx monorepo per plan.md's Project Structure:

- `libs/domain/accounts/src/lib/` — backend domain lib (framework-independent entity + validation)
- `libs/api-contract/src/lib/account-overview.ts` — shared request/response DTOs
- `apps/backend/src/account-overview/` — NestJS module (controller/service/repository/mapper)
- `apps/backend/src/database/database.service.ts` — schema registration (modified)
- `apps/backend/src/app/app.module.ts` — module registration (modified)
- `apps/backend/src/tests/account-overview.e2e-spec.ts` — e2e test
- `libs/frontend/domain/account-overview/src/lib/` — frontend page + form components (replaces
  the existing `account-overview-placeholder/`)
- `apps/frontend/src/app/app.routes.ts` — route target (modified)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the new backend domain library; everything else builds on it.

- [ ] T001 Create `libs/domain/accounts` Nx library (package.json, project.json, tsconfig\*.json,
      jest.config.cts, src/index.ts) mirroring `libs/domain/holdings`'s exact config shape

**Checkpoint**: `npm exec nx run domain-accounts:test` (or the lib's actual project name) runs
(empty/passing) before any domain code is added.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain shape, shared contract types, SQLite schema, and the backend module skeleton
that every user story's endpoints depend on. No user story's frontend/backend work can start
until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 [P] Define `AccountCategory` union + `ACCOUNT_CATEGORIES` ordered list in
      `libs/domain/accounts/src/lib/account-category.ts` (data-model.md's `AccountCategory`
      section — fixed order General → Leisure → Savings → Credit Card → Other)
- [ ] T003 [P] Define `Account` entity class in `libs/domain/accounts/src/lib/account.ts` (all
      fields per data-model.md's Account table: id, name, category, provider, website, purpose,
      cardUsage, requiredMinimum, notes, ownerId, createdAt, updatedAt) mirroring
      `libs/domain/holdings/src/lib/holding.ts`'s shape
- [ ] T004 [US-shared] Implement `account-validation.ts` in
      `libs/domain/accounts/src/lib/account-validation.ts`: required non-empty-after-trim `name`
      (FR-006), category whitelist check against `ACCOUNT_CATEGORIES` (defaults to `OTHER` when
      omitted), trims every optional string field and normalizes empty-after-trim to `null` —
      mirrors `holding-validation.ts`'s `FieldError` shape (depends on T002, T003)
- [ ] T005 [P] Unit tests for `account-validation.ts` in
      `libs/domain/accounts/src/lib/account-validation.spec.ts`: rejects blank/whitespace-only
      name, rejects unknown category literal, defaults missing category to `OTHER`, trims and
      null-normalizes every optional field (depends on T004)
- [ ] T006 [P] Unit tests for the `Account` entity in `libs/domain/accounts/src/lib/account.spec.ts`
      (construction/shape), mirroring `holding.spec.ts` (depends on T003)
- [ ] T007 Export `AccountCategory`, `ACCOUNT_CATEGORIES`, `Account`, validation functions/types
      through `libs/domain/accounts/src/index.ts` (depends on T002-T004)
- [ ] T008 [P] Define shared contract types in `libs/api-contract/src/lib/account-overview.ts`:
      `AccountCategory`, `AccountOverviewEntry`, `CreateAccountOverviewEntryRequest`,
      `UpdateAccountOverviewEntryRequest`, `AccountOverviewValidationErrorResponse`,
      `AccountOverviewNotFoundErrorResponse` per contracts/account-overview-api.md, and re-export
      from `libs/api-contract/src/index.ts`
- [ ] T009 Add the `accounts` table + `accounts_owner_id_idx` index to
      `initializeSchema()` in `apps/backend/src/database/database.service.ts` per data-model.md's
      SQLite schema (exact DDL: CHECK constraints on `name`/`category`, `owner_id` nullable
      unindexed FK, `created_at`/`updated_at` defaults)
- [ ] T010 [P] Implement `account-overview.mapper.ts` in
      `apps/backend/src/account-overview/account-overview.mapper.ts`: SQLite row ↔ `Account`
      domain entity ↔ `AccountOverviewEntry` DTO (snake_case ↔ camelCase), mirroring
      `holdings.mapper.ts` (depends on T003, T008)
- [ ] T011 Implement `account-overview.repository.ts` in
      `apps/backend/src/account-overview/account-overview.repository.ts`: `findAllByOwner(ownerId)`
      (ordered by `created_at ASC`), `findByIdForOwner(id, ownerId)`, `insert(account)`,
      `updateForOwner(id, ownerId, patch)`, `deleteForOwner(id, ownerId)` using
      `DatabaseService.query()` raw SQL, scoped by `owner_id` (research.md #3) — mirrors
      `holdings.repository.ts` (depends on T009, T010)
- [ ] T012 [P] Repository unit tests in
      `apps/backend/src/account-overview/account-overview.repository.spec.ts`: insert/find/update/
      delete round-trips, owner-scoping (a row for a different `ownerId` is invisible), mirroring
      `holdings.repository.spec.ts` (depends on T011)
- [ ] T013 Implement `account-overview.service.ts` in
      `apps/backend/src/account-overview/account-overview.service.ts`: orchestrates validation
      (T004) + repository (T011), throws a not-found domain error when an id doesn't resolve for
      the caller's `ownerId`
- [ ] T014 Implement `account-overview.controller.ts` in
      `apps/backend/src/account-overview/account-overview.controller.ts`:
      `GET/POST/PUT/DELETE /account-overview/accounts[/:id]` behind
      `@RequiresDomain('account-overview')` + `@CurrentUser()`, translating validation/not-found
      errors into the structured `VALIDATION_FAILED`/`ACCOUNT_NOT_FOUND` response bodies per
      contracts/account-overview-api.md (depends on T013)
- [ ] T015 [P] Controller unit tests in
      `apps/backend/src/account-overview/account-overview.controller.spec.ts`: each endpoint's
      success/error response shape (201/200/204/400/404) per contracts/account-overview-api.md
      (depends on T014)
- [ ] T016 Implement `account-overview.module.ts` in
      `apps/backend/src/account-overview/account-overview.module.ts` wiring
      controller/service/repository, mirroring `holdings.module.ts`
- [ ] T017 Register `AccountOverviewModule` in `apps/backend/src/app/app.module.ts` alongside
      `HoldingsModule` (depends on T016)

**Checkpoint**: Backend API surface for `/account-overview/accounts` is fully implemented, tested,
and wired into the app — the frontend user stories below only need to consume it.

---

## Phase 3: User Story 1 - See a central reference of all accounts (Priority: P1) 🎯 MVP

**Goal**: A read-only overview page listing every recorded account (name, category, provider link,
purpose, detail fields), with a clear empty state when there are none.

**Independent Test**: Seed accounts via the API, open the overview page, and confirm every account
and its recorded fields are visible — including the empty-state fallback with zero accounts —
without add/edit/delete being built yet.

### Implementation for User Story 1

- [ ] T018 [P] [US1] Implement `account-overview.service.ts` (frontend HTTP client) in
      `libs/frontend/domain/account-overview/src/lib/account-overview.service.ts`: `list()` calling
      `GET /account-overview/accounts`, returning `AccountOverviewEntry[]`, mirroring the shape of
      `holdings.component.ts`'s existing service usage
- [ ] T019 [US1] Implement the read-only overview rendering in
      `libs/frontend/domain/account-overview/src/lib/account-overview-page/account-overview-page.component.ts`:
      fetches the list (T018), renders category groups in the fixed order (General → Leisure →
      Savings → Credit Card → Other), one bordered card per in-use category with a header (name +
      count) and account rows (initials avatar, name, provider-as-link-when-website-present,
      purpose, detail chips for cardUsage/requiredMinimum/notes — only non-empty values shown,
      per design.md's account-row shape); renders a single "All accounts" group instead of
      per-category groups when every account is `OTHER` (design.md's flat view, Edge Cases)
      (depends on T018)
- [ ] T020 [US1] Implement the empty state in the same
      `account-overview-page.component.ts`/its template: centered card with icon, "No accounts
      yet" copy, and a primary "Add your first account" button, replacing the whole content region
      when the account count is zero (FR-011, design.md's Empty state region) (depends on T019)
- [ ] T021 [US1] Replace routing/exports: update
      `libs/frontend/domain/account-overview/src/index.ts` to export
      `AccountOverviewPageComponent` instead of `AccountOverviewPlaceholderComponent`, delete the
      `account-overview-placeholder/` directory, and update
      `apps/frontend/src/app/app.routes.ts`'s lazy import to the new page component (depends on
      T019, T020)
- [ ] T022 [P] [US1] Component tests in
      `libs/frontend/domain/account-overview/src/lib/account-overview-page/account-overview-page.component.spec.ts`:
      renders every account with its fields, groups by category in fixed order, omits empty
      category groups, collapses to a single flat group when all accounts are `OTHER`, shows the
      empty state at zero accounts (depends on T019, T020)

**Checkpoint**: At this point, User Story 1 is fully functional and independently testable — a
seeded set of accounts is fully visible on the overview page, correctly grouped, with the empty
state working.

---

## Phase 4: User Story 2 - Add, edit, and remove accounts (Priority: P2)

**Goal**: Users can create, edit, and delete accounts from the overview page itself, with required-
name validation and a delete confirmation step.

**Independent Test**: Create an account through the add form, confirm it appears on the overview;
edit one of its fields and confirm the change is reflected; delete it (confirming the prompt) and
confirm it disappears; submitting with a blank name is rejected with an explanatory error.

### Implementation for User Story 2

- [ ] T023 [US2] Extend `account-overview.service.ts` (frontend) with `create()`, `update(id,
    patch)`, `remove(id)` methods calling `POST`/`PUT`/`DELETE /account-overview/accounts[/:id]`,
      surfacing `AccountOverviewValidationErrorResponse`/`AccountOverviewNotFoundErrorResponse`
      bodies to callers (depends on T018)
- [ ] T024 [US2] Implement the add/edit modal in
      `libs/frontend/domain/account-overview/src/lib/account-overview-form/account-overview-form.component.ts`:
      PrimeNG `Dialog` reused for add and edit, fields in design.md's order (name, category
      `Select` defaulting to "Other", provider, website, purpose, card usage, required minimum,
      notes textarea), inline required-name error on blank submit (FR-006), Cancel/Save footer
      actions (depends on T002/T008 for the category list and DTO shapes)
- [ ] T025 [US2] Wire the "Add account" toolbar button and each account row's edit icon (from
      `account-overview-page.component.ts`, T019) to open `AccountOverviewFormComponent` in add or
      edit mode, and the empty state's "Add your first account" button to the same add flow
      (FR-003/FR-004) (depends on T019, T024)
- [ ] T026 [US2] Wire each account row's delete icon to a PrimeNG `ConfirmDialog` prompt before
      calling `account-overview.service.ts`'s `remove()` (FR-005, research.md #4), refreshing the
      list on success (depends on T023, T025)
- [ ] T027 [US2] On successful add/edit save, refetch or locally patch the list so the overview
      reflects the change immediately with no manual refresh (SC-003) (depends on T023, T025)
- [ ] T028 [P] [US2] Component tests for `account-overview-form.component.ts` in
      `libs/frontend/domain/account-overview/src/lib/account-overview-form/account-overview-form.component.spec.ts`:
      blank-name submission is rejected with an inline error and no submit call is made; a fully
      filled-in form submits the expected create/update payload (depends on T024)
- [ ] T029 [P] [US2] Backend e2e test in `apps/backend/src/tests/account-overview.e2e-spec.ts`
      against a real temp SQLite file: create → appears in list → edit → delete, plus the
      blank-name 400 and not-found 404 cases, mirroring
      `holdings-persistence.e2e-spec.ts` (depends on T014, T016, T017)

**Checkpoint**: At this point, User Stories 1 AND 2 both work independently — accounts can be
listed, added, edited, and deleted end-to-end.

---

## Phase 5: User Story 3 - Structure accounts using a multi-account model, or not (Priority: P3)

**Goal**: Confirm and harden the category-grouping behavior from US1/US2 for the multi-account
use case — verifying categorization is fully optional with zero loss of function either way.

**Independent Test**: Create accounts across every category (including leaving some uncategorized)
and confirm the overview groups/counts them correctly in the fixed order; edit every account back
to uncategorized and confirm the overview still displays a single flat list with no empty-group
clutter and no lost functionality.

### Implementation for User Story 3

> Note: the category `Select` (T024), fixed grouping order and per-group counts (T019), and the
> flat-view collapse (T019, Edge Cases) are already implemented as part of US1/US2 above — this
> phase adds the tests that specifically validate the multi-account/no-multi-account acceptance
> scenarios called out by spec.md's US3, and closes any gap found.

- [ ] T030 [P] [US3] Component test in `account-overview-page.component.spec.ts` (extends T022):
      seeding one account per category (General, Leisure, Savings, Credit Card, Other) renders one
      group per category in that exact order, each showing its account count (FR-009, SC-005)
      (depends on T022)
- [ ] T031 [P] [US3] Component test in `account-overview-page.component.spec.ts` (extends T022):
      editing every categorized account to `OTHER` (or deleting them) collapses the view to a
      single flat/"All accounts" group with no per-category headers, while every account remains
      fully visible and its edit/delete actions remain usable (Edge Cases, SC-004) (depends on
      T022, T027)
- [ ] T032 [US3] Manually validate quickstart.md's Scenario 3 (grouping and the uncategorized
      fallback) against the running app; fix any discrepancy found in T019/T024 (depends on T030,
      T031)

**Checkpoint**: All user stories are independently functional — the multi-account model is fully
optional with no functional gap for a user who ignores it.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup once all user stories are complete.

- [ ] T033 [P] Run `npm exec nx run domain-accounts:lint`, the backend's lint target, and the
      frontend domain library's lint target; fix any violation
- [ ] T034 Run `npm exec nx affected -t test` (or the equivalent explicit project list covering
      `domain-accounts`, `backend`, `frontend-domain-account-overview`, `api-contract`) and confirm
      all suites pass, including the new e2e-spec (T029)
- [ ] T035 Execute quickstart.md's Scenario 1 (empty state) and Scenario 2 (add/view/edit/delete)
      end-to-end against the running app, confirming every "Expect" step

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001) — BLOCKS all user stories (US1's frontend
  needs the backend API from this phase to be real, not just for its own tests).
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion.
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2); reuses US1's page component
  (T019) and service (T018), so in practice follows Phase 3.
- **User Story 3 (Phase 5)**: Depends on US1 (T019, T022) and US2 (T027) — this phase is
  verification/hardening of behavior already implemented by those, not new UI surface.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start once Phase 2 is done. No dependency on US2/US3.
- **User Story 2 (P2)**: Can start once Phase 2 is done, but shares files with US1 (the page
  component, the frontend service) — implement after US1 to avoid rework, per the sample
  structure above.
- **User Story 3 (P3)**: Depends on US1's grouping implementation and US2's edit-to-recategorize
  flow existing; it is a verification layer, not independent new functionality — spec.md still
  frames it as independently testable once US1+US2 exist.

### Within Each Phase

- Domain/contract types before validation before repository before service before controller
  before module registration (Phase 2).
- Frontend service before page component before form component before wiring (Phases 3-4).
- Tests for a task can run in parallel with the next task only when they target different files
  (marked `[P]`).

### Parallel Opportunities

- T002 and T003 (category union, entity) — different files.
- T005 and T006 (validation spec, entity spec) — different files, once their implementation tasks
  land.
- T008 (contract types) can proceed in parallel with T002-T007 (different library).
- T010 (mapper) can start once T003/T008 land, in parallel with T009 (schema).
- T012 and T015 (repository spec, controller spec) — different files, once their respective
  implementation tasks land.
- T022, T028, T029 — different test files, can run in parallel once their implementation
  dependencies land.
- T030 and T031 — different test cases in the same file; can be written in parallel but land as
  one commit to that file.

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch domain-lib scaffolding together (different files):
Task: "Define AccountCategory union in libs/domain/accounts/src/lib/account-category.ts"
Task: "Define Account entity class in libs/domain/accounts/src/lib/account.ts"

# Launch the shared contract types in parallel with domain-lib work (different library):
Task: "Define shared contract types in libs/api-contract/src/lib/account-overview.ts"
```

## Parallel Example: User Story 1

```bash
# Frontend service and later component tests are separable once their targets exist:
Task: "Implement account-overview.service.ts (list()) in libs/frontend/domain/account-overview/..."
Task: "Component tests for account-overview-page.component.ts (once implemented)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001).
2. Complete Phase 2: Foundational (T002-T017) — full backend API, schema, and domain lib.
3. Complete Phase 3: User Story 1 (T018-T022) — read-only overview + empty state.
4. **STOP and VALIDATE**: Seed accounts via the API directly, confirm the overview renders them
   correctly and the empty state works with zero accounts.
5. Deploy/demo if ready — this alone satisfies SC-001.

### Incremental Delivery

1. Setup + Foundational → backend API ready, fully tested.
2. Add User Story 1 → read-only overview works → demo (MVP!).
3. Add User Story 2 → add/edit/delete works → demo.
4. Add User Story 3 → grouping/uncategorized behavior verified and hardened → demo.
5. Polish (Phase 6) → lint, full test run, manual quickstart validation.

### Parallel Team Strategy

With multiple developers, once Phase 2 (Foundational) is complete:

- Developer A: User Story 1 (T018-T022).
- Developer B: starts US2's form component (T024) against the contract types (T008) once US1's
  page skeleton (T019) exists to wire into.
- US3 (Phase 5) is inherently sequential after both, since it verifies their combined behavior.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- This feature stores no monetary values (FR-012) — no decimal/exact-value test mandate applies
  (plan.md's Constitution Check, Principle III).
- Commit after each task or logical group.
- Stop at any checkpoint to validate story independently.
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence.
