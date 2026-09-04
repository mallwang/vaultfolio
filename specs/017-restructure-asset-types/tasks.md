---
description: 'Task list template for feature implementation'
---

# Tasks: Restructure Asset Types (Precious Metal / Crypto)

**Input**: Design documents from `/specs/017-restructure-asset-types/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/holdings-api-asset-types.md, quickstart.md

**Tests**: Included — plan.md's Testing section and the Constitution Check (Principles III/IV)
explicitly call for domain unit tests, a migration idempotency test, backend service/repository
unit tests, an updated e2e spec, and Angular component tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing
of each story. All three user stories are P1 and share the same rename/migration substrate
(research.md #4's inventory), so most renaming work is Foundational; each story's phase then adds
only what's specific to it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Nx monorepo: `apps/backend/src/`, `apps/frontend/src/app/`, `libs/domain/holdings/src/lib/`,
`libs/api-contract/src/lib/` — paths below are exact, taken from plan.md's Project Structure.

---

## Phase 1: Setup

**Purpose**: No new project scaffolding needed — this feature amends existing libs/apps only
(plan.md Structure Decision: no new Nx apps/libs).

- [ ] T001 Run `grep -rln "GOLD\|BITCOIN" apps/ libs/ --include="*.ts" --include="*.html"` (excluding `dist`/`out-tsc`) and confirm the result matches exactly the file inventory in [research.md](./research.md) #4, so later tasks in this file have no missed files

**Checkpoint**: Inventory confirmed — proceed to Foundational phase.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rename `GOLD`/`BITCOIN` → `PRECIOUS_METAL`/`CRYPTO` end-to-end, add the required
`name` field to both, amend the merge key, and migrate existing data. This is the shared substrate
every user story's acceptance scenarios depend on — none of the three stories can be independently
tested until this phase is done.

**⚠️ CRITICAL**: No user story work can be verified until this phase is complete.

### Domain library (`libs/domain/holdings`) — Principle I

- [ ] T002 [P] Rename `GOLD`→`PRECIOUS_METAL`, `BITCOIN`→`CRYPTO` in `ASSET_TYPES`/`AssetType` union and add `name` to `ASSET_TYPE_FIELDS['PRECIOUS_METAL'].required`/`['CRYPTO'].required` in `libs/domain/holdings/src/lib/asset-type.ts` (data-model.md AssetType table, FR-001–FR-004)
- [ ] T003 [P] Update `computeValue()`'s `'GOLD'` check to `'PRECIOUS_METAL'` in `libs/domain/holdings/src/lib/holding.ts`
- [ ] T004 [US1][US2] Add `name` (non-blank, trimmed) as a required-field-loop entry for `PRECIOUS_METAL` and `CRYPTO` in `libs/domain/holdings/src/lib/holding-validation.ts`, producing `FieldError` `"name is required for {assetType}."` on blank input (data-model.md Validation rule changes, FR-009, SC-004)
- [ ] T005 [US1] Change the `GOLD` branch in `holding-merge.ts`'s `decideMerge()` to a `PRECIOUS_METAL` branch that also compares `holding.name === submission.name` alongside `management`, and rename the `BITCOIN` branch to `CRYPTO` (unconditional `{ kind: 'create' }`, unchanged) in `libs/domain/holdings/src/lib/holding-merge.ts` (data-model.md Merge/upsert rule changes, FR-005, FR-006)
- [ ] T006 [P] Update `libs/domain/holdings/src/lib/holding-merge.spec.ts` for the renamed types and the new `(name, management)` Precious metal match/no-match cases (Gold vs. Gold merges; Gold vs. Silver does not), with exact-decimal assertions per Principle III
- [ ] T007 [P] Update `libs/domain/holdings/src/lib/holding-validation.spec.ts` for the renamed types, the new required `name` field on Precious metal/Crypto, and the blank-name rejection message

### Shared API contract (`libs/api-contract`)

- [ ] T008 Rename `AssetType` union member values, `CreateGoldHoldingRequest`→`CreatePreciousMetalHoldingRequest` (+ `name: string`), `CreateBitcoinHoldingRequest`→`CreateCryptoHoldingRequest` (+ `name: string`), and update the `CreateHoldingRequest`/`UpdateHoldingRequest` discriminated unions in `libs/api-contract/src/lib/holdings.ts` (data-model.md Shared API contract types)

### Backend — migration (Principle IV)

- [ ] T009 Implement `migrateAssetTypeRestructure()` in `apps/backend/src/database/database.service.ts`: idempotency-guard on the stored `holdings` `CREATE TABLE` text containing `'PRECIOUS_METAL'`, then inside one `db.transaction()` — create `holdings_new` with the widened `asset_type`/`holdings_fields_match_asset_type` CHECKs, backfill via the deterministic `CASE`-based `INSERT INTO holdings_new SELECT ...` (research.md #1), drop/rename, recreate `holdings_upsert_lookup_idx` and `holdings_owner_id_idx`, and log the outcome (rows migrated, or "already migrated, skipped") per the existing `DatabaseService` logging pattern (FR-007, FR-008)
- [ ] T010 [US3] Add a `database.service.spec.ts` case that seeds pre-migration `GOLD`/`BITCOIN` fixture rows into a real SQLite file, runs the migration, and asserts: rows now show `PRECIOUS_METAL`/`CRYPTO` with `name` `"Gold"`/`"Bitcoin"`, every other column (management, quantity, weight_grams, current_value, owner_id, created_at, updated_at) unchanged, and running the migration a second time produces zero further changes (idempotency) in `apps/backend/src/database/database.service.spec.ts` (FR-007, FR-008, SC-002, SC-003)

### Backend — repository/service/controller

- [ ] T011 Generalize `HoldingsRepository.findUpsertMatch()`'s SQL to a three-branch match (`ETF` on `isin = $3`, `PRECIOUS_METAL` on `name = $3`, no lookup for `SHARE`/`CRYPTO`) in `apps/backend/src/holdings/holdings.repository.ts` (research.md #2, FR-005)
- [ ] T012 [P] Update `apps/backend/src/holdings/holdings.repository.spec.ts` for the renamed types and the new Precious metal `(name, management)` lookup branch
- [ ] T013 Change `HoldingsService.create()`'s upsert-lookup ternary from `value.assetType === 'ETF' ? value.isin : null` to also pass `name` for `PRECIOUS_METAL` (`value.assetType === 'ETF' ? value.isin : value.assetType === 'PRECIOUS_METAL' ? value.name : null`) in `apps/backend/src/holdings/holdings.service.ts` (research.md #2, FR-005)
- [ ] T014 [P] Update `apps/backend/src/holdings/holdings.controller.spec.ts` for the renamed types and new required `name` field
- [ ] T015 [P] Update the `GOLD` fixture row in the delete-cascade test to `PRECIOUS_METAL` with a `name` value, matching the new `holdings_fields_match_asset_type` CHECK, in `apps/backend/src/auth/users.repository.spec.ts` (research.md #4)

### Frontend — shared field config and translations

- [ ] T016 [P] Rename asset type entries and field sets from `GOLD`/`BITCOIN` to `PRECIOUS_METAL`/`CRYPTO`, adding `name` to each type's required fields, in `apps/frontend/src/app/holdings/asset-type-fields.ts`
- [ ] T017 [P] Update asset type labels, the reused name-field label, and empty-state copy for the renamed types in `apps/frontend/src/app/core/i18n/translations/en.ts`
- [ ] T018 [P] Update the same asset type labels, name-field label, and empty-state copy (German) in `apps/frontend/src/app/core/i18n/translations/de.ts`

**Checkpoint**: Rename, required `name` field, merge-key change, and startup migration are all in
place and covered by tests. All three user stories can now be exercised end-to-end.

---

## Phase 3: User Story 1 - Record a precious metal holding by name (Priority: P1) 🎯 MVP

**Goal**: A user can add a Precious metal holding named "Silver" (or any free-text name), have it
saved as its own entry distinct from "Gold", and have a repeat submission with the same name and
Management update that entry in place rather than duplicating it.

**Independent Test**: Add a holding of type "Precious metal" with name "Silver" and a weight, save
it, and see it listed as a silver holding distinct from a gold one.

### Implementation for User Story 1

- [ ] T019 [US1] Change the type selector control from a `p-select` dropdown to a set of selectable buttons/cards (ETF / Share / Precious metal / Crypto, all visible at once) in the add-holding dialog in `apps/frontend/src/app/holdings/holding-form/holding-form.component.ts` and `holding-form.component.html`, keeping the edit-holding dialog's locked-type display unchanged (FR-012, design.md's approved mockup)
- [ ] T020 [US1] Ensure the holding form renders a `name` input for Precious metal (alongside the existing weight-in-grams field) reusing the existing ETF/Share name-field control, with the same trimmed non-blank validation message wired to `holding-form.component.html`/`.ts` in `apps/frontend/src/app/holdings/holding-form/`
- [ ] T021 [US1] Update `apps/frontend/src/app/holdings/holdings.component.html` to display each Precious metal holding by its entered `name` (e.g. "Silver") wherever the list currently shows a type-derived label (FR-010)
- [ ] T022 [US1] Update `apps/frontend/src/app/holdings/holding-form/holding-form.component.spec.ts` for the button/card type selector, the new Precious metal `name` field, and its required-field validation
- [ ] T023 [US1] Update `apps/frontend/src/app/holdings/holdings.component.spec.ts` for Precious metal rows displaying by `name`

**Checkpoint**: User Story 1 is fully functional and independently testable — add "Gold" and
"Silver" precious metal holdings under the same Management, confirm two separate rows; add "Gold"
again under the same Management, confirm in-place update (quickstart.md checks #1–#3).

---

## Phase 4: User Story 2 - Record a crypto holding by name (Priority: P1)

**Goal**: A user can add a Crypto holding named "Ethereum" (or any free-text name), have it saved
as its own independent lot (never merged, matching today's Bitcoin behavior), and have an empty
name rejected with a clear validation message.

**Independent Test**: Add a holding of type "Crypto" with name "Ethereum", a quantity, and a
purchase price, save it, and see it listed as its own lot distinct from a Bitcoin holding.

### Implementation for User Story 2

- [ ] T024 [US2] Ensure the holding form renders a `name` input for Crypto (alongside the existing quantity/purchase price/optional purchase date fields), reusing the same name-field control and validation message pattern as US1's Precious metal wiring, in `apps/frontend/src/app/holdings/holding-form/holding-form.component.ts`/`.html`
- [ ] T025 [US2] Update `apps/frontend/src/app/holdings/holdings.component.html` to display each Crypto holding by its entered `name` (e.g. "Ethereum") wherever the list currently shows a type-derived label (FR-010)
- [ ] T026 [US2] Extend `holding-form.component.spec.ts` for the Crypto `name` field, including the empty-name rejection case (Acceptance Scenario 2) in `apps/frontend/src/app/holdings/holding-form/holding-form.component.spec.ts`
- [ ] T027 [US2] Extend `holdings.component.spec.ts` for Crypto rows displaying by `name`, including two same-named lots appearing as two separate rows in `apps/frontend/src/app/holdings/holdings.component.spec.ts`

**Checkpoint**: User Stories 1 AND 2 both work independently — add "Ethereum" crypto, confirm a
second "Ethereum" submission adds a second row (no merge); attempt an empty crypto name and confirm
rejection (quickstart.md checks #4–#5).

---

## Phase 5: User Story 3 - Existing gold and Bitcoin holdings keep working after the change (Priority: P1)

**Goal**: Every pre-existing `GOLD`/`BITCOIN` holding is visible after deployment as
`PRECIOUS_METAL`/`CRYPTO` named `"Gold"`/`"Bitcoin"`, with every other field unchanged, and the
migration never re-runs or duplicates data on subsequent restarts.

**Independent Test**: Take a database containing pre-change gold and Bitcoin holdings, apply the
change, and confirm those holdings now appear as precious metal / crypto holdings named
"Gold"/"Bitcoin", with all other fields unchanged.

> Note: the migration itself (T009) and its idempotency unit test (T010) were built in the
> Foundational phase, since every other user story's acceptance scenarios implicitly depend on the
> backend being able to start against a pre-migration database. This phase adds the end-to-end
> (real HTTP) proof and updates the remaining renamed-type test/fixture surface not yet covered.

### Tests for User Story 3 ⚠️

- [ ] T028 [US3] Update `apps/backend/src/tests/holdings.e2e-spec.ts` for the renamed types, the new required `name` field on Precious metal/Crypto, the `(name, management)` upsert contract test (two `PRECIOUS_METAL` submissions, same `management` + different `name` → two `201`s; same `management` + same `name` → `201` then `200`), and a `POST /holdings` with `"assetType": "GOLD"` asserting `400` (contracts/holdings-api-asset-types.md, FR-005, FR-011)
- [ ] T029 [P] [US3] Update `apps/backend/src/tests/holdings-persistence.e2e-spec.ts` for the renamed types

### Implementation for User Story 3

- [ ] T030 [US3] Add `<app-holdings-distribution>` to the Holdings page (in addition to its existing Dashboard placement) in `apps/frontend/src/app/holdings/holdings.component.ts`/`.html` (FR-013)
- [ ] T031 [US3] Change `HoldingsDistributionComponent.recompute()`'s grouping `Map` key from `holding.assetType` alone to `` `${holding.assetType}::${holding.name}` `` for `PRECIOUS_METAL`/`CRYPTO` holdings (ETF/Share unchanged), using each group's `holding.name` as the chart entry's label, in `apps/frontend/src/app/holdings/holdings-distribution/holdings-distribution.component.ts` (research.md #3, FR-010)
- [ ] T032 [P] [US3] Update `apps/frontend/src/app/holdings/holdings-distribution/holdings-distribution.component.spec.ts` for per-name grouping of Precious metal/Crypto holdings (e.g. "Gold" and "Silver" as separate slices; two same-named Crypto lots summing into one slice)

**Checkpoint**: All three user stories are independently functional. Full quickstart.md manual
validation (checks #1–#10) can now be run end-to-end.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories.

- [ ] T033 [P] Run `npx nx test domain-holdings` and confirm all domain unit tests pass (quickstart.md Automated validation)
- [ ] T034 [P] Run `npx nx test backend` and confirm all backend unit + integration tests, including the migration test and updated e2e specs, pass (quickstart.md Automated validation)
- [ ] T035 [P] Run `npx nx test frontend` and confirm all frontend component tests pass (quickstart.md Automated validation)
- [ ] T036 Walk through quickstart.md's Manual / exploratory validation checks #1–#10 end-to-end against a running local stack and confirm each passes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001's inventory check). BLOCKS all user stories — none of the three stories' acceptance scenarios can be exercised against a backend/frontend that still validates/persists the old `GOLD`/`BITCOIN` shape.
- **User Stories (Phase 3–5)**: All depend on Foundational phase completion. All three are P1; they touch mostly disjoint files (US1: form type-selector + Precious metal name field; US2: Crypto name field; US3: e2e tests + distribution grouping) and can proceed in parallel once Foundational is done, though US1 and US2 both edit `holding-form.component.ts`/`.html` (see Parallel Opportunities).
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Foundational. No dependency on US2/US3.
- **User Story 2 (P1)**: Depends only on Foundational. Shares `holding-form.component.ts`/`.html` with US1 (both add a `name` field for their respective type) — sequence T019–T020 before T024 if worked by the same person/agent to avoid edit conflicts; otherwise independently testable.
- **User Story 3 (P1)**: Depends only on Foundational (the migration itself, T009–T010, is Foundational). Its e2e/distribution tasks touch different files than US1/US2 and can run fully in parallel with them.

### Within Each User Story

- Implementation before its own spec-file updates where a spec asserts the new behavior (e.g. T019–T021 before T022–T023).
- Story complete and checkpoint-verified before moving to Polish.

### Parallel Opportunities

- Foundational: T002, T003 in parallel (different files); T006, T007 in parallel; T012, T014, T015 in parallel; T016, T017, T018 in parallel.
- Once Foundational completes, US1 (T019–T023), US2 (T024–T027), and US3 (T028–T032) can be staffed in parallel — except T019–T020 (US1) and T024 (US2) share `holding-form.component.ts`/`.html`, so sequence those two within that one file if done by the same worker.
- Polish: T033, T034, T035 in parallel.

---

## Parallel Example: Foundational Phase

```bash
# Domain library renames, launched together:
Task: "Rename GOLD/BITCOIN in asset-type.ts"
Task: "Update computeValue()'s GOLD check in holding.ts"

# Backend/frontend spec + translation updates, launched together:
Task: "Update holdings.repository.spec.ts for renamed types"
Task: "Update holdings.controller.spec.ts for renamed types"
Task: "Update users.repository.spec.ts GOLD fixture"
Task: "Update asset-type-fields.ts"
Task: "Update en.ts translations"
Task: "Update de.ts translations"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — includes the migration, which User Story 3 also
   needs, but must exist before any story is testable).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: quickstart.md checks #1–#3, #9.
5. Deploy/demo if ready — a user can now record non-gold precious metals.

### Incremental Delivery

1. Setup + Foundational → rename, migration, and merge-key change all land together (they're one
   inseparable substrate per research.md).
2. Add User Story 1 → validate → demo (MVP).
3. Add User Story 2 → validate → demo.
4. Add User Story 3's remaining e2e/distribution work → validate → demo.
5. Polish: full automated + manual quickstart pass.

### Parallel Team Strategy

With multiple developers, once Foundational is merged:

- Developer A: User Story 1 (form type-selector, Precious metal name field)
- Developer B: User Story 2 (Crypto name field) — coordinate with A on shared form files
- Developer C: User Story 3 (e2e contract tests, distribution grouping, Holdings-page panel)

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- This feature's three user stories are more tightly coupled than a typical spec (all P1, all
  depending on the same rename/migration substrate) — Foundational is deliberately large here
  because research.md #4 already enumerated the exact file inventory, so front-loading it avoids a
  vague "update all references" task.
- Commit after each task or logical group.
- Avoid: reintroducing `GOLD`/`BITCOIN` literals anywhere in `apps/`/`libs/` outside historical
  git history; verify with T001's grep pattern again after Phase 2 if in doubt.
