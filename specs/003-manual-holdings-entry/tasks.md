---
description: 'Task list template for feature implementation'
---

# Tasks: Manual Holdings Entry

**Input**: Design documents from `/specs/003-manual-holdings-entry/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user
stories), [research.md](./research.md), [data-model.md](./data-model.md),
[contracts/holdings-api.md](./contracts/holdings-api.md), [quickstart.md](./quickstart.md)

**Tests**: Included — plan.md's Constitution Check commits to Principle III (TDD, domain library
tests written first) and Principle IV (real-HTTP integration test), matching the project's existing
`libs/domain/example` and `health.e2e-spec.ts` precedents. Follow this order strictly within each
scope: write the test, confirm it fails, then implement.

**Organization**: Tasks are grouped by user story per spec.md's priorities (US1/US2 are both P1;
US3/US4 are P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

## Path Conventions

Nx monorepo, per [plan.md](./plan.md)'s Project Structure:

- `libs/domain/holdings/src/lib/` — new domain library (Principle I)
- `libs/api-contract/src/lib/holdings.ts` — shared DTOs
- `apps/backend/src/holdings/` — new NestJS feature module
- `apps/backend/src/database/database.service.ts` — extended with the holdings migration
- `apps/backend/src/tests/holdings.e2e-spec.ts` — integration test
- `apps/frontend/src/app/holdings/` — existing placeholder area, replaced

---

## Phase 1: Setup

**Purpose**: Scaffold the new Nx projects/files this feature needs before any logic is written.

- [x] T001 Generate the `domain-holdings` Nx library at `libs/domain/holdings` mirroring
      `libs/domain/example`'s config exactly (`README.md`, `package.json`, `jest.config.cts`,
      `.spec.swcrc`, `tsconfig.json`/`tsconfig.lib.json`/`tsconfig.spec.json`, `src/index.ts`),
      tagged `scope:domain`, with no NestJS/Angular dependency
- [x] T002 [P] Confirm/add the `decimal.js` dependency to `libs/domain/holdings/package.json`
      (already a workspace dependency per plan.md's Technical Context — reuse the version pinned in
      `libs/domain/example/package.json`)
- [x] T003 [P] Add `chart.js` and PrimeNG's `p-chart` module as a new frontend runtime dependency
      (`apps/frontend/package.json` / workspace root, per research.md #6 — the one new dependency
      this feature introduces)
- [x] T004 [P] Create the `libs/api-contract/src/lib/holdings.ts` file (empty shell + export from
      `libs/api-contract/src/index.ts`) so backend and frontend can import it once populated in T011

**Checkpoint**: New projects build (`pnpm nx build domain-holdings`, `pnpm nx build api-contract`)
with no source yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The domain model, validation, merge rules, shared DTOs, DB schema, and backend module
skeleton that every user story's implementation tasks depend on. Per Principle III, tests are
written and confirmed failing before their implementation task.

**⚠️ CRITICAL**: No user story implementation task may begin until this phase is complete.

- [x] T005 [P] Define `AssetType` union and per-type required/optional field metadata in
      `libs/domain/holdings/src/lib/asset-type.ts`, per data-model.md's AssetType table (FR-001)
- [x] T006 [P] Write `libs/domain/holdings/src/lib/holding-validation.spec.ts` covering every rule
      in data-model.md's "Validation rules" section (positive quantity/price/weight/currentValue,
      non-future purchaseDate when provided, non-empty management, per-type required/forbidden
      fields, ISIN checksum pass/fail cases) — confirm it fails (no implementation yet)
      (FR-002–FR-010, Edge Cases)
- [x] T007 [US-shared] Implement `libs/domain/holdings/src/lib/holding-validation.ts` (including the
      ISIN checksum function per research.md #1) to make T006 pass, plus the `Holding` domain model
      in `libs/domain/holdings/src/lib/holding.ts` (Decimal-typed fields, no `purity`/`weightUnit`,
      per data-model.md's Holding table)
- [x] T008 [P] Write `libs/domain/holdings/src/lib/holding-merge.spec.ts` covering data-model.md's
      merge/upsert rule (ETF upsert-by-isin+management, Gold upsert-by-management, Share/Bitcoin
      always-new, different-management-creates-separate-row) — confirm it fails (FR-011, FR-011a)
- [x] T009 Implement `libs/domain/holdings/src/lib/holding-merge.ts` (pure decision function: given
      an incoming submission and the set of existing holdings, return
      create-new/update-existing-by-id) to make T008 pass (depends on T007)
- [x] T010 Export `AssetType`, `Holding`, validation, and merge functions from
      `libs/domain/holdings/src/index.ts`; run `pnpm nx test domain-holdings` and confirm all specs
      pass (depends on T005, T007, T009)
- [x] T011 [P] Populate `libs/api-contract/src/lib/holdings.ts` with `AssetType`, `HoldingResponse`,
      and per-type `CreateHoldingRequest`/`UpdateHoldingRequest` interfaces (decimal fields as
      strings), per data-model.md's "Shared API contract types" section and
      contracts/holdings-api.md's JSON shapes
- [x] T012 Add the `holdings` table migration (the exact DDL in data-model.md's "Persistence"
      section — `NUMERIC(20,8)` columns, `holdings_fields_match_asset_type` CHECK constraint,
      `holdings_upsert_lookup_idx` index) to `apps/backend/src/database/database.service.ts`,
      extending its existing `CREATE TABLE IF NOT EXISTS` migration pattern
- [x] T013 [P] Scaffold the NestJS `holdings` feature module: `apps/backend/src/holdings/
  holdings.module.ts`, register it in `apps/backend/src/app/app.module.ts` alongside
      `DatabaseModule`/`HealthModule`
- [x] T014 Implement `apps/backend/src/holdings/holdings.mapper.ts` (DB row ↔ domain `Holding` ↔
      `HoldingResponse`/`CreateHoldingRequest` DTO mapping, decimal string ↔ `Decimal` conversion)
      (depends on T007, T011)
- [x] T015 Implement `apps/backend/src/holdings/holdings.repository.ts` (raw `pg` queries: list all,
      insert, update by id, delete by id, and the ETF/Gold upsert-lookup query from
      `holdings_upsert_lookup_idx`) (depends on T012, T014)
- [x] T016 Implement `apps/backend/src/holdings/holdings.service.ts` orchestrating domain validation
      (T007) + merge decision (T009) + repository (T015), including structured logging on
      create/update/delete (id, asset type, management, create-vs-update outcome) per Principle V
      (depends on T009, T015)
- [x] T017 Implement `apps/backend/src/holdings/holdings.controller.ts` exposing
      `GET /holdings`, `POST /holdings`, `PUT /holdings/:id`, `DELETE /holdings/:id` per
      contracts/holdings-api.md (structured 400/404 error bodies, 200 vs 201 distinction on POST)
      (depends on T016)
- [x] T018 Create the shell of `apps/backend/src/tests/holdings.e2e-spec.ts` (supertest against a
      running Nest app instance with a real Postgres connection, matching `health.e2e-spec.ts`'s
      setup/teardown pattern) with no test cases yet — populated per-story in Phases 3–6
      (depends on T017)

**Checkpoint**: `pnpm nx test domain-holdings` and `pnpm nx build backend` pass; `GET /holdings`
returns `[]` against a running stack. User story implementation can now begin.

---

## Phase 3: User Story 1 - Record a New Holding (Priority: P1) 🎯 MVP

**Goal**: A user can add a holding of any of the four asset types via a type-driven form, with
per-type field sets, validation, and ETF/Gold upsert-in-place vs. Share/Bitcoin always-new-lot
behavior.

**Independent Test**: Open the Holdings area, add one holding of each asset type with valid data,
confirm each appears in the holdings list with the details entered (per spec.md's Independent Test
for this story).

### Tests for User Story 1

- [x] T019 [P] [US1] Add `POST /holdings` contract test cases to
      `apps/backend/src/tests/holdings.e2e-spec.ts`: valid create for each of the four asset types
      asserting `201` and the exact response shape (contracts/holdings-api.md); a second matching
      POST for ETF and Gold asserting `200` with the same `id` and replaced values, confirmed via a
      follow-up `GET /holdings` showing no duplicate row; a second matching POST for Share/Bitcoin
      asserting a second `201` with a distinct `id` — confirm these fail before T021 (FR-001,
      FR-011, FR-011a)
- [x] T020 [P] [US1] Add `POST /holdings` validation-failure cases to `holdings.e2e-spec.ts`: each
      Edge Case (negative quantity, negative price, negative weight, negative currentValue, future
      purchase date, malformed ISIN, missing Management, missing required type-specific field,
      extraneous fields for the wrong type) asserting the exact `400` `fieldErrors` shape — confirm
      these fail before T021 (FR-009, FR-010, SC-002)

### Implementation for User Story 1

- [x] T021 [US1] Wire `POST /holdings` end-to-end (controller → service → merge decision →
      repository, already scaffolded in Phase 2) until T019/T020 pass; run
      `pnpm nx test backend` to confirm
- [x] T022 [P] [US1] Create `apps/frontend/src/app/holdings/holdings.service.ts` — `HttpClient`
      wrapper for `POST /holdings` (and `GET`, reused by US2) against the shared
      `libs/api-contract` DTOs
- [x] T023 [US1] Create the add/edit form scaffold `apps/frontend/src/app/holdings/holding-form/
  holding-form.component.ts/html/css`: Angular Reactive Form, `p-select` for asset type (add
      mode only), universal `p-inputtext` Management field, `p-inputnumber`/`p-datepicker` controls
      for the per-type fields per research.md #5 and asset-type.ts's field metadata (depends on
      T005, T022)
- [x] T024 [US1] Implement per-type field-set switching in `holding-form.component.ts`: selecting a
      new asset type resets/clears controls not applicable to it (Edge Cases: "MUST discard/reset
      fields that don't apply") and shows/hides the purchase-date control per type (never for
      ETF/Gold, optional for Share/Bitcoin) (depends on T023)
- [x] T025 [US1] Implement client-side validation feedback in `holding-form.component.ts/html`
      matching the domain rules (positive quantity/price/weight/currentValue, non-future date, ISIN
      format, non-empty Management) with clear per-field messages, and wire submit to
      `holdings.service.ts`'s create call, surfacing server-side `400` `fieldErrors` on failure
      (FR-009, FR-010, SC-002) (depends on T024)
- [x] T026 [US1] Wire an "Add holding" action in `apps/frontend/src/app/holdings/
  holdings.component.ts/html` that opens `holding-form` in a `p-dialog` (add mode) and appends
      the created/updated holding to the in-memory list on success (depends on T023, T025)
- [x] T027 [P] [US1] Write `apps/frontend/src/app/holdings/holding-form/
  holding-form.component.spec.ts` covering: per-type field visibility, field reset on type
      switch, client-side validation blocking submit, and successful submit calling the service
      (depends on T026)

**Checkpoint**: User Story 1 is fully functional and independently testable — a user can add a
holding of each type and see it validated/persisted.

---

## Phase 4: User Story 2 - Review My Holdings (Priority: P1)

**Goal**: A user sees all entered holdings in a list with key details, plus a distribution-by-value
view, and a clear empty state when there are none.

**Independent Test**: Add several holdings across asset types/Management sources and confirm the
list displays each with its details and the distribution view reflects relative values (per
spec.md's Independent Test for this story).

### Tests for User Story 2

- [x] T028 [P] [US2] Add `GET /holdings` contract test cases to `holdings.e2e-spec.ts`: empty
      database returns `200` `[]`; after creating holdings of each type, `GET /holdings` returns
      all of them with the exact field shape per contracts/holdings-api.md — confirm these fail
      before T029 (FR-012, FR-013)

### Implementation for User Story 2

- [x] T029 [US2] Wire `GET /holdings` end-to-end (controller → service → repository, already
      scaffolded in Phase 2) until T028 passes
- [x] T030 [US2] Implement the holdings list in `apps/frontend/src/app/holdings/
  holdings.component.ts/html/css` using `p-table`: fetch via `holdings.service.ts` on init,
      display asset type, identifying label (name/ISIN or "Gold"/"Bitcoin"), quantity/weight,
      Management, price (or "—" indicator), purchase date (or "—"), with client-side paging/sorting
      per plan.md's Constraints (FR-012, Edge Cases: usable with dozens of lots)
- [x] T031 [US2] Implement the empty state in `holdings.component.html` (distinct from
      loading/error states) shown when the fetched list is empty, inviting the user to add their
      first holding (FR-013, depends on T030)
- [x] T032 [P] [US2] Create `apps/frontend/src/app/holdings/holdings-distribution/
  holdings-distribution.component.ts/html/css` computing each holding's share of total value
      (quantity × purchasePrice for Share/Bitcoin/ETF, currentValue for Gold; holdings with no
      computable value excluded from the percentage base, not zero) and rendering it via `p-chart`
      per research.md #6 (FR-012a)
- [x] T033 [US2] Embed `holdings-distribution` in `holdings.component.html`, fed by the same fetched
      list as the table, hidden/empty-safe when there are no valued holdings (depends on T030,
      T032)
- [x] T034 [P] [US2] Write `apps/frontend/src/app/holdings/holdings.component.spec.ts` covering:
      list rendering with mixed asset types, "—" indicators for missing price/date, empty-state
      rendering, and distribution view excluding valueless Gold holdings (depends on T033)

**Checkpoint**: User Stories 1 AND 2 both work independently — holdings can be added and reviewed,
including the distribution view.

---

## Phase 5: User Story 3 - Correct a Mistake (Priority: P2)

**Goal**: A user can edit an existing holding's fields, scoped to that holding's own asset type,
with the same validation as creation, and can cancel without altering stored values.

**Independent Test**: Add a holding, edit one or more fields, save, and confirm the list reflects
the updated values while other holdings are unchanged (per spec.md's Independent Test for this
story).

### Tests for User Story 3

- [x] T035 [P] [US3] Add `PUT /holdings/:id` contract test cases to `holdings.e2e-spec.ts`: create a
      holding, edit one field, assert `200` and the updated value round-trips on a subsequent `GET`
      with other holdings untouched; assert the same `400` `fieldErrors` shape as `POST` on invalid
      input; assert `404` `HOLDING_NOT_FOUND` for a non-existent `id` — confirm these fail before
      T036 (FR-014, contracts/holdings-api.md)

### Implementation for User Story 3

- [x] T036 [US3] Wire `PUT /holdings/:id` end-to-end (controller → service → repository — direct
      edit by id, no upsert-lookup, `assetType` immutable and not accepted in the body) until T035
      passes
- [x] T037 [US3] Add an edit-mode entry point (row action in `holdings.component.html`) that opens
      `holding-form` pre-filled with the selected holding's values, asset type locked/read-only
      (FR-008, depends on T030)
- [x] T038 [US3] Extend `holding-form.component.ts` to support edit mode: only the holding's own
      asset type's fields are shown (no stray fields for other types), submit calls
      `holdings.service.ts`'s update call instead of create, and the same client-side validation as
      creation applies (FR-014, depends on T025, T037)
- [x] T039 [US3] Implement cancel in `holding-form.component.ts/html`: closes the dialog without
      calling the update endpoint, leaving the holding's stored values unchanged (FR-015, depends
      on T038)
- [x] T040 [P] [US3] Extend `holding-form.component.spec.ts` with edit-mode cases: pre-filled
      values, locked asset type, only-own-type fields shown, cancel leaves state unchanged, invalid
      edit blocked (depends on T039)

**Checkpoint**: User Stories 1, 2, AND 3 all work independently — holdings can be added, reviewed,
and corrected.

---

## Phase 6: User Story 4 - Remove a Holding (Priority: P2)

**Goal**: A user can delete a holding after explicit confirmation, with graceful handling of an
already-deleted holding.

**Independent Test**: Add a holding, delete it, and confirm it no longer appears in the list while
other holdings remain untouched (per spec.md's Independent Test for this story).

### Tests for User Story 4

- [x] T041 [P] [US4] Add `DELETE /holdings/:id` contract test cases to `holdings.e2e-spec.ts`:
      create and delete a holding, assert `204`, assert a subsequent `GET /holdings` no longer
      includes it, assert a second `DELETE` of the same `id` returns `404` — confirm these fail
      before T042 (FR-016, contracts/holdings-api.md)

### Implementation for User Story 4

- [x] T042 [US4] Wire `DELETE /holdings/:id` end-to-end (controller → service → repository, hard
      delete) until T041 passes
- [x] T043 [US4] Add a delete action (row action in `holdings.component.html`) that opens a
      `p-confirmdialog` showing the holding's summary before calling
      `holdings.service.ts`'s delete call, per research.md #7 (FR-016, depends on T030)
- [x] T044 [US4] On successful delete, remove the holding from the in-memory list; on decline,
      leave the list unchanged (FR-016 Acceptance Scenario 2, depends on T043)
- [x] T045 [US4] Handle a `404` response from the delete call as a non-error success path: treat as
      already-gone, refresh the list, and show an informative toast rather than an error message,
      per research.md #7 (Edge Cases: already-deleted-elsewhere, depends on T044)
- [x] T046 [P] [US4] Extend `holdings.component.spec.ts` with delete cases: confirm-then-remove,
      decline-leaves-unchanged, 404-treated-as-success (depends on T045)

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements spanning multiple user stories, plus final validation per the
constitution's Development Workflow & Quality Gates.

- [x] T047 [P] Re-run `/speckit-ux-review` (or manually reconcile design.md) against the final
      per-type field set implemented in Phase 3/5, per plan.md's Summary note that the existing
      mockup predates the Management/Gold/ETF clarifications
- [x] T048 [P] Review structured logging added in T016 against Principle V — confirm every
      create/update/delete logs id, asset type, management, and outcome (created vs. updated vs.
      deleted)
- [x] T049 Run the full quickstart.md manual/exploratory validation checklist (all 12 items) against
      a running local stack
- [x] T050 Run `pnpm nx test domain-holdings`, `pnpm nx test backend`, `pnpm nx test frontend`, and
      `pnpm nx build backend frontend` (or `pnpm nx run-many`) and confirm everything passes per the
      constitution's Quality Gates

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories. T007 depends on T006;
  T009 depends on T007, T008; T010 depends on T005, T007, T009; T014 depends on T007, T011; T015
  depends on T012, T014; T016 depends on T009, T015; T017 depends on T016; T018 depends on T017.
- **User Stories (Phase 3–6)**: All depend on Foundational (Phase 2) completion.
  - US1 (Phase 3) and US2 (Phase 4) are both P1 — no dependency on each other's _tests_, but US2's
    list/distribution view is more useful once US1 can create data; recommended sequential order
    below reflects this without a hard code dependency (US2's `GET` wiring only needs Phase 2).
  - US3 (Phase 5) depends on US1's `holding-form` component (T023–T025) for its edit-mode reuse,
    and on US2's list (T030) for its row action entry point.
  - US4 (Phase 6) depends on US2's list (T030) for its row action entry point.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Foundational only.
- **US2 (P1)**: Foundational only (independently testable via `GET /holdings` once Phase 2 is
  done, though seeding data for manual testing benefits from US1 being done first).
- **US3 (P2)**: Foundational + reuses US1's form component and US2's list/row actions.
- **US4 (P2)**: Foundational + reuses US2's list/row actions.

### Within Each User Story

- Contract/component tests are written and confirmed failing before their implementation task.
- Backend wiring (controller/service/repository, already scaffolded in Phase 2) before frontend
  service calls.
- Frontend service before components that call it.
- List/table before the row actions (edit, delete) and distribution view that hang off it.

### Parallel Opportunities

- T002, T003, T004 (Setup) can run in parallel.
- T005, T006, T008, T011, T013 (Foundational) can run in parallel with each other (different
  files); T007 and T009 are sequential gates within the domain library.
- Once Phase 2 completes, US1 and US2's backend wiring (T021, T029) can proceed in parallel — they
  touch different controller methods on the same file, so coordinate if worked by different people.
- T019/T020 (US1 tests), T028 (US2 test), T035 (US3 test), T041 (US4 test) can each be written in
  parallel with the others, being different test cases in the same file — merge carefully.
- T027, T034, T040, T046 (component specs) can run in parallel with each other once their
  respective story's implementation lands.
- T047, T048 (Polish) can run in parallel.

---

## Parallel Example: Foundational Phase

```bash
# Launch independent Foundational tasks together:
Task: "Define AssetType union in libs/domain/holdings/src/lib/asset-type.ts"
Task: "Write holding-validation.spec.ts covering all validation rules"
Task: "Write holding-merge.spec.ts covering the upsert/lot rules"
Task: "Populate libs/api-contract/src/lib/holdings.ts with shared DTOs"
Task: "Scaffold the NestJS holdings feature module"
```

## Parallel Example: User Story 1

```bash
# Launch US1 contract-test cases together (same file, coordinate merge):
Task: "POST /holdings success + upsert-vs-new-lot cases in holdings.e2e-spec.ts"
Task: "POST /holdings validation-failure cases in holdings.e2e-spec.ts"

# Then, once T021 passes, frontend work:
Task: "Create holdings.service.ts HttpClient wrapper"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Add one holding of each asset type per spec.md's Independent Test for US1
5. Deploy/demo if ready — note that without US2 there is no list UI to see the result in, so pair
   US1 with at least T029/T030 from US2 for a demoable MVP in practice

### Incremental Delivery

1. Complete Setup + Foundational → domain rules and API skeleton ready
2. Add User Story 1 → validate via `POST /holdings` contract tests
3. Add User Story 2 → validate list + distribution view → first demoable increment (MVP)
4. Add User Story 3 → validate edit → deploy/demo
5. Add User Story 4 → validate delete → deploy/demo
6. Polish phase → full quickstart.md validation, logging review, mockup reconciliation

### Parallel Team Strategy

With multiple developers, after Setup + Foundational:

- Developer A: User Story 1 (form + create)
- Developer B: User Story 2 (list + distribution)
- Developer C: waits for A+B's components to land, then picks up User Story 3 and/or 4 (both reuse
  US1/US2 components, so genuine parallelism is limited until those checkpoints are reached)

---

## Notes

- [P] tasks = different files, no dependencies (or clearly-partitioned edits to a shared test file,
  called out above).
- [Story] label maps task to specific user story for traceability.
- Tests are written and confirmed failing before their corresponding implementation task
  (Principle III/IV).
- Commit after each task or logical group, per this feature's `auto_commit` extension config.
- Stop at any checkpoint to validate the story independently before proceeding.
- All monetary/quantity fields use `Decimal` (`decimal.js`) end-to-end and `NUMERIC` at the DB layer
  — never a native `number`/`FLOAT`, per the constitution's Money/decimal handling clause.
