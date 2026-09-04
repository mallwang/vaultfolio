---
description: 'Task list template for feature implementation'
---

# Tasks: Deposit Money Asset Type

**Input**: Design documents from `/specs/018-deposit-money/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/holdings-api-deposit-money.md, quickstart.md

**Tests**: Included — plan.md's Constitution Check (Principles III & IV) requires exact-value-asserted tests for the `currentValue >= 0` boundary, upsert-in-place behavior, and the migration/API contract amendment before this feature is done.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Nx monorepo: `libs/domain/holdings/src/lib/`, `libs/api-contract/src/lib/`, `apps/backend/src/`, `apps/frontend/src/app/` — per plan.md's Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No project initialization needed — this feature extends existing projects only, no new Nx app/lib, no new dependency.

- [ ] T001 Confirm `nx affected -t lint,test` runs clean on `main` before starting, as a baseline (no code changes in this task)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core domain/contract/schema changes that every user story's behavior depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 [P] Add `'DEPOSIT_MONEY'` to the `AssetType` union and its `ASSET_TYPE_FIELDS` metadata (required: `name`, `currentValue`; absent: `isin`, `quantity`, `purchasePrice`, `purchaseDate`, `weightGrams`; `management` required as for all types) in [libs/domain/holdings/src/lib/asset-type.ts](../../libs/domain/holdings/src/lib/asset-type.ts)
- [ ] T003 [P] Add `'DEPOSIT_MONEY'` to the `AssetType` union in [libs/api-contract/src/lib/holdings.ts](../../libs/api-contract/src/lib/holdings.ts) and add the new `CreateDepositMoneyHoldingRequest` interface (`assetType: 'DEPOSIT_MONEY'`, `management`, `name`, `currentValue`), including it in the `CreateHoldingRequest`/`UpdateHoldingRequest` unions (`Omit<..., 'assetType'>` for the latter, per data-model.md)
- [ ] T004 [US-shared] Widen `currentValue`'s floor from `> 0` to `>= 0` in the shared decimal parser (`parsePositiveDecimal`) used by `currentValue` validation in [libs/domain/holdings/src/lib/holding-validation.ts](../../libs/domain/holdings/src/lib/holding-validation.ts) (depends on T002; `quantity`/`purchasePrice`/`weightGrams` keep their `> 0` floor unchanged)
- [ ] T005 [P] Add a `DEPOSIT_MONEY` branch to `Holding.computeValue()` in [libs/domain/holdings/src/lib/holding.ts](../../libs/domain/holdings/src/lib/holding.ts) that returns `currentValue` directly, matching `PRECIOUS_METAL`'s existing branch (depends on T002)
- [ ] T006 [P] Unit tests for the `currentValue >= 0` boundary (`0` accepted, negative rejected, positive unaffected) for both `DEPOSIT_MONEY` and `PRECIOUS_METAL` in [libs/domain/holdings/src/lib/holding-validation.spec.ts](../../libs/domain/holdings/src/lib/holding-validation.spec.ts) (depends on T004)
- [ ] T007 [P] Unit tests for `DEPOSIT_MONEY` required-field enforcement (missing `name`/`currentValue` rejected and identified by field) and extraneous-field rejection (`isin`, `quantity`, `purchasePrice`, `purchaseDate`, `weightGrams`) in [libs/domain/holdings/src/lib/holding-validation.spec.ts](../../libs/domain/holdings/src/lib/holding-validation.spec.ts) (depends on T002)
- [ ] T008 [P] Unit test for `Holding.computeValue()`'s new `DEPOSIT_MONEY` branch (returns `currentValue` directly) alongside the existing `holding.ts` test suite (depends on T005) — add to `libs/domain/holdings/src/lib/holding.spec.ts` (create if it does not already exist)
- [ ] T009 Add a new migration step in `DatabaseService` that rebuilds the `holdings` table: widen the `asset_type` CHECK to include `'DEPOSIT_MONEY'`, relax `current_value`'s CHECK from `> 0` to `>= 0`, and add the `DEPOSIT_MONEY` clause to `holdings_fields_match_asset_type` (name + current_value required, all other fields NULL); guard idempotency by checking the stored `CREATE TABLE` text for `'DEPOSIT_MONEY'`, mirroring `migrateAssetTypeRestructure()` — in [apps/backend/src/database/database.service.ts](../../apps/backend/src/database/database.service.ts) (depends on T002)
- [ ] T010 Integration tests for the new migration: fresh DB accepts `DEPOSIT_MONEY` + `current_value = 0`; re-running migration on an already-migrated DB is a no-op; pre-existing holdings survive unchanged in [apps/backend/src/database/database.service.spec.ts](../../apps/backend/src/database/database.service.spec.ts) (depends on T009)
- [ ] T011 Add request/row mapping for the `DEPOSIT_MONEY` create/update shape in [apps/backend/src/holdings/holdings.mapper.ts](../../apps/backend/src/holdings/holdings.mapper.ts) (depends on T003, T009)

**Checkpoint**: Foundation ready — domain model, shared parser, schema, and mapper all recognize `DEPOSIT_MONEY`; user story implementation can now begin

---

## Phase 3: User Story 1 - Record a cash balance as a holding (Priority: P1) 🎯 MVP

**Goal**: A user can select "Deposit money" in the holdings-entry flow, enter name + managing institution + current value, and see it saved and listed.

**Independent Test**: Open the holdings-entry flow, select deposit-money, enter a name and current value, save, and confirm the holding appears in the holdings list with the values entered.

### Tests for User Story 1 ⚠️

- [ ] T012 [P] [US1] Integration test: `POST /holdings` with a valid `DEPOSIT_MONEY` body returns `201` with `assetType: "DEPOSIT_MONEY"` and the submitted fields, and `GET /holdings` includes it, in [apps/backend/src/holdings/holdings.controller.spec.ts](../../apps/backend/src/holdings/holdings.controller.spec.ts)
- [ ] T013 [P] [US1] Integration tests: `POST /holdings` with `DEPOSIT_MONEY` missing `name` or `currentValue` returns `400 VALIDATION_FAILED` naming the missing field; with a negative `currentValue` returns `400` naming `currentValue`; with `currentValue: "0"` returns `201`; with any of `isin`/`quantity`/`purchasePrice`/`purchaseDate`/`weightGrams` present returns `400` naming that field — in [apps/backend/src/holdings/holdings.controller.spec.ts](../../apps/backend/src/holdings/holdings.controller.spec.ts)

### Implementation for User Story 1

- [ ] T014 [US1] Add `'DEPOSIT_MONEY'` to `ASSET_TYPES` and its field set (`name` + `currentValue` only, no purchase date) in [apps/frontend/src/app/holdings/asset-type-fields.ts](../../apps/frontend/src/app/holdings/asset-type-fields.ts) (depends on T002)
- [ ] T015 [US1] Add `assetType.DEPOSIT_MONEY` i18n key/label in [apps/frontend/src/app/core/i18n/translations/en.ts](../../apps/frontend/src/app/core/i18n/translations/en.ts) and [apps/frontend/src/app/core/i18n/translations/de.ts](../../apps/frontend/src/app/core/i18n/translations/de.ts) (depends on T014)
- [ ] T016 [US1] Wire the new `DEPOSIT_MONEY` form fields (name, managing institution, current value; no quantity/price/ISIN/purchase-date/weight) into [apps/frontend/src/app/holdings/holding-form/holding-form.component.ts](../../apps/frontend/src/app/holdings/holding-form/holding-form.component.ts) and its template, reusing the existing field-set-driven rendering (depends on T014, T015)
- [ ] T017 [US1] Frontend component test: selecting `DEPOSIT_MONEY` shows only name/institution/current-value fields and hides quantity/price/ISIN/purchase-date/weight, in [apps/frontend/src/app/holdings/holding-form/holding-form.component.spec.ts](../../apps/frontend/src/app/holdings/holding-form/holding-form.component.spec.ts) (depends on T016)

**Checkpoint**: User Story 1 is fully functional and independently testable — a deposit-money holding can be created via API and UI and appears in the holdings list

---

## Phase 4: User Story 2 - Update an existing deposit-money balance (Priority: P2)

**Goal**: Resubmitting a deposit-money holding with the same name + managing institution updates its current value in place rather than creating a duplicate.

**Independent Test**: Re-submit a deposit-money holding with the same name/institution but a different current value, and confirm the existing holding's value is replaced, not duplicated; confirm a same-name-different-institution holding is unaffected.

### Tests for User Story 2 ⚠️

- [ ] T018 [P] [US2] Integration test: submitting `POST /holdings` twice with the same `(name, management)` for `DEPOSIT_MONEY` results in exactly one holding, with the second `currentValue` value in effect, in [apps/backend/src/holdings/holdings.controller.spec.ts](../../apps/backend/src/holdings/holdings.controller.spec.ts) (depends on T012)
- [ ] T019 [P] [US2] Integration test: two `DEPOSIT_MONEY` holdings with the same `name` but different `management` remain distinct after one is updated, in [apps/backend/src/holdings/holdings.controller.spec.ts](../../apps/backend/src/holdings/holdings.controller.spec.ts) (depends on T012)
- [ ] T020 [P] [US2] Unit test: `decideMerge()` matches an existing `DEPOSIT_MONEY` row on `(name, management)`, in [libs/domain/holdings/src/lib/holding-merge.spec.ts](../../libs/domain/holdings/src/lib/holding-merge.spec.ts)

### Implementation for User Story 2

- [ ] T021 [US2] Add `'DEPOSIT_MONEY'` to the upsert-lookup gate (`assetType === 'ETF' || assetType === 'PRECIOUS_METAL'`) in `HoldingsService.create()`, in [apps/backend/src/holdings/holdings.service.ts](../../apps/backend/src/holdings/holdings.service.ts) (depends on T011)

**Checkpoint**: User Stories 1 AND 2 both work independently — deposit-money creation and update-in-place both function via the API and UI

---

## Phase 5: User Story 3 - See deposit money reflected in overall wealth (Priority: P3)

**Goal**: Deposit-money holdings count toward the portfolio overview's total wealth and are shown distinctly labeled (by name), not blended unlabeled into another asset type.

**Independent Test**: Record one or more deposit-money holdings and confirm the portfolio overview's total includes their current values, each distinguishable by its own label.

### Tests for User Story 3 ⚠️

- [ ] T022 [P] [US3] Frontend test: `HoldingsDistributionComponent` groups `DEPOSIT_MONEY` holdings as a named group (`${assetType}::${name}`, like `PRECIOUS_METAL`/`CRYPTO`), not merged into one unlabeled slice, in [apps/frontend/src/app/holdings/holdings-distribution/holdings-distribution.component.spec.ts](../../apps/frontend/src/app/holdings/holdings-distribution/holdings-distribution.component.spec.ts)
- [ ] T023 [P] [US3] Test: `ASSET_TYPE_COLORS` has a distinct entry for `DEPOSIT_MONEY`, in [apps/frontend/src/app/shared/chart/chart-palette.spec.ts](../../apps/frontend/src/app/shared/chart/chart-palette.spec.ts)

### Implementation for User Story 3

- [ ] T024 [P] [US3] Add `'DEPOSIT_MONEY'` to the `isNamedGroup` check in [apps/frontend/src/app/holdings/holdings-distribution/holdings-distribution.component.ts](../../apps/frontend/src/app/holdings/holdings-distribution/holdings-distribution.component.ts) (depends on T014)
- [ ] T025 [P] [US3] Add a new, visually distinct `DEPOSIT_MONEY` entry to `ASSET_TYPE_COLORS` in [apps/frontend/src/app/shared/chart/chart-palette.ts](../../apps/frontend/src/app/shared/chart/chart-palette.ts)

**Checkpoint**: All three user stories are independently functional — deposit money can be created, updated in place, and is reflected distinctly in the portfolio overview total

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation and documentation

- [ ] T026 Run `nx affected -t lint,test` (or `nx run-many -t lint,test -p domain-holdings api-contract backend frontend`) and fix any failures across all touched projects
- [ ] T027 Walk through [quickstart.md](quickstart.md) end-to-end (create, validation edge cases, update-in-place, portfolio overview total, migration check against a pre-existing DB) and confirm every expected result holds

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (domain type, shared parser floor, schema/CHECK constraints, and mapper must exist before any story-level work)
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 (P1): No dependency on US2/US3
  - US2 (P2): Depends on US1's `POST /holdings` path existing (T012) for its tests, and on the mapper/gate from Foundational; independently testable via repeated submissions
  - US3 (P3): Depends on US1's holdings existing to distribute/total; independently testable via the portfolio overview alone
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### Within Each User Story

- Tests before implementation (write first, confirm they fail, then implement)
- Domain/contract/schema (Foundational) before service/mapper (US-level) before UI

### Parallel Opportunities

- T002, T003 in parallel (different files: domain lib vs. api-contract lib)
- T005, T006, T007 in parallel once T002/T004 land (different concerns, T006/T007 same spec file — sequential within that file if run by the same agent)
- T012, T013 in parallel (same file, independent test cases — safe if appended, not safe if run by literally simultaneous edits to the same file by different agents; treat as logically parallelizable, serialize file edits)
- T018, T019, T020 in parallel (two different backend spec additions + one domain spec, distinct files/concerns)
- T022, T023 in parallel (different spec files); T024, T025 in parallel (different implementation files)

---

## Parallel Example: Foundational Phase

```bash
Task: "Add 'DEPOSIT_MONEY' to AssetType union + ASSET_TYPE_FIELDS in libs/domain/holdings/src/lib/asset-type.ts"
Task: "Add 'DEPOSIT_MONEY' to AssetType union + CreateDepositMoneyHoldingRequest in libs/api-contract/src/lib/holdings.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Add DEPOSIT_MONEY to isNamedGroup in holdings-distribution.component.ts"
Task: "Add DEPOSIT_MONEY entry to ASSET_TYPE_COLORS in chart-palette.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Create a deposit-money holding via API and UI, confirm it's listed
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → domain/contract/schema ready for `DEPOSIT_MONEY`
2. Add User Story 1 → test independently → deploy/demo (MVP: record a cash balance)
3. Add User Story 2 → test independently → deploy/demo (update in place, no duplicates)
4. Add User Story 3 → test independently → deploy/demo (counted + labeled in overview total)
5. Polish: full regression + quickstart walkthrough

### Parallel Team Strategy

With multiple developers, once Foundational (Phase 2) is done:

- Developer A: User Story 1 (form/API path)
- Developer B: User Story 2 (upsert gate + tests) — can start once US1's create path exists
- Developer C: User Story 3 (distribution grouping + palette) — can start once US1's create path exists
