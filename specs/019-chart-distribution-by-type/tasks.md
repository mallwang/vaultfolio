---
description: 'Task list for Distribution Chart Grouped by Asset Type'
---

# Tasks: Distribution Chart Grouped by Asset Type

**Input**: Design documents from `/specs/019-chart-distribution-by-type/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: Included — plan.md/research.md #6 and Constitution Principle III explicitly require
extending the existing unit tests with exact-value assertions for this change.

**Organization**: This feature has a single user story (P1 — see spec.md); there is no Setup or
Foundational work beyond what already exists in the repo, so tasks go straight to the User Story 1
phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1)
- Include exact file paths in descriptions

## Path Conventions

Single Angular component, per plan.md Project Structure:

- `apps/frontend/src/app/holdings/holdings-distribution/holdings-distribution.component.ts`
- `apps/frontend/src/app/holdings/holdings-distribution/holdings-distribution.component.spec.ts`

---

## Phase 1: Setup

Not applicable — no new project, dependency, or tooling is introduced (plan.md Technical Context:
Angular + ECharts already in place).

---

## Phase 2: Foundational

Not applicable — no shared/blocking infrastructure precedes this change; the single existing
component is modified directly.

---

## Phase 3: User Story 1 - See portfolio value split by asset type (Priority: P1) 🎯 MVP

**Goal**: Every distribution-by-value chart slice represents exactly one `AssetType`, labeled with
its existing localized `assetType.*` name, valued as the sum of that type's holdings' computed
values — never split or labeled by an individual holding's own name (FR-001–FR-007).

**Independent Test**: Per spec.md — add differently-named holdings sharing a type (e.g. Crypto
"Bitcoin" + "Ethereum", Deposit money "Bargeld" + "Savings account") plus one each of ETF, Share,
Precious metal; open the distribution chart and verify exactly one correctly-summed slice per
type present, each labeled with the type's localized name, with no individual holding name ever
appearing as a label.

### Tests for User Story 1 ⚠️

> Write/extend these tests FIRST, ensure the new/changed assertions FAIL against the current
> per-name-grouping code before implementing.

- [x] T001 [P] [US1] In `apps/frontend/src/app/holdings/holdings-distribution/holdings-distribution.component.spec.ts`, replace/extend the existing "groups Precious metal/Crypto/Deposit money by name" case with a case asserting that two differently-named holdings of the same type (e.g. Crypto "Bitcoin" `quantity`×`purchasePrice` + "Ethereum" `quantity`×`purchasePrice`) produce exactly one `chartOption` slice whose `value` is the exact Decimal-computed sum of both (research.md #6a).
- [x] T002 [P] [US1] In the same spec file, add/extend a case for Deposit money ("Bargeld" + "Savings account", both via `currentValue`) asserting one summed slice, and a case for a single-holding type (e.g. one Precious metal holding, e.g. "Gold") asserting its slice is still labeled by the type, never the holding's `name` (spec.md Acceptance Scenario 4).
- [x] T003 [P] [US1] In the same spec file, add/extend a case asserting every produced slice's rendered `name` in `chartOption` resolves through `ASSET_TYPE_LABEL_KEYS`/`TranslatePipe` (e.g. `assetType.CRYPTO` → "Crypto"), never a raw holding `name`, across all five asset types present in one fixture (research.md #6b, spec.md SC-003).
- [x] T004 [P] [US1] In the same spec file, add/extend a case asserting a type is omitted entirely when all its holdings lack a computable value (e.g. a Share with no `quantity`/`purchasePrice`), and that `excludedCount` still reflects such holdings unchanged (research.md #6c, spec.md Edge Cases, FR-004/FR-007).
- [x] T005 [US1] Run `npm exec nx test frontend -- --testPathPattern=holdings-distribution` and confirm the T001–T004 assertions fail against the current per-name-grouping implementation (pre-implementation red state).

### Implementation for User Story 1

- [x] T006 [US1] In `apps/frontend/src/app/holdings/holdings-distribution/holdings-distribution.component.ts`, simplify the `HoldingsDistributionEntry` interface per data-model.md: drop the `name`/`isTranslationKey` fields, keep `assetType: AssetType` and `value: number` only.
- [x] T007 [US1] In the same file, rewrite `recompute()` per data-model.md's grouping algorithm: key the `totals` map directly by `holding.assetType` (drop the `isNamedGroup`/`${assetType}::${name}` branch entirely), summing `computeValue(holding)` as `Decimal` per type, and build `entries` as `{ assetType, value }` (depends on T006).
- [x] T008 [US1] In the same file, simplify `chartOption`'s `resolveName` to always resolve the slice name via `this.translate.transform(ASSET_TYPE_LABEL_KEYS[entry.assetType])` (drop the `isTranslationKey` ternary and the now-removed `entry.name`/`entry.isTranslationKey` reads), keeping `ASSET_TYPE_COLORS[entry.assetType]` coloring and all other chart option fields unchanged (depends on T006).
- [x] T009 [US1] Update the file-level and `HoldingsDistributionEntry`/component doc comments in the same file (currently describing per-name grouping for Precious metal/Crypto/Deposit money) to describe the new always-by-type grouping, matching data-model.md/research.md.
- [x] T010 [US1] Run `npm exec nx test frontend -- --testPathPattern=holdings-distribution` and confirm all tests (including T001–T004) now pass (post-implementation green state).

**Checkpoint**: User Story 1 — the feature's entire scope — is fully implemented and independently
testable; the distribution-by-value chart shows at most one slice per `AssetType`.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [x] T011 [P] Run `npm exec nx lint frontend` and fix any lint issues introduced by T006–T009.
- [ ] T012 Manually validate against quickstart.md's "Manual validation" steps (add mixed-name/same-type holdings across all five types, confirm slice count/sums/labels, confirm a language switch relabels without changing values, confirm an uncomputable holding stays excluded).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup / Foundational**: N/A — no blocking prerequisites for this feature.
- **User Story 1 (Phase 3)**: The only story; can start immediately.
- **Polish (Phase 4)**: Depends on User Story 1 (Phase 3) completion.

### Within User Story 1

- T001–T004 (tests) are independent of each other (same file, but non-overlapping test cases) and
  should be written/extended before implementation; T005 (confirm red) depends on T001–T004.
- T006 (interface) blocks T007 and T008 (both consume the simplified entry shape).
- T007 and T008 touch the same file but different methods (`recompute()` vs `chartOption`) — do
  sequentially to avoid merge conflicts within one file, in either order, both after T006.
- T009 (doc comments) can be done alongside T006–T008.
- T010 (confirm green) depends on T006–T009.

### Parallel Opportunities

- T001, T002, T003, T004 are marked [P] — they are independent test cases, but since all four
  land in the same spec file, apply them as one coordinated edit pass (or sequential edits)
  rather than literally concurrent tool calls, to avoid clobbering each other's diffs.
- T011 [P] can run any time after T006–T009 land, in parallel with T012.

---

## Parallel Example: User Story 1

```bash
# Test cases for User Story 1 (same file — coordinate edits, run together once written):
Task: "Assert same-type differently-named holdings collapse into one summed slice"
Task: "Assert single-holding type still labels by type, not holding name"
Task: "Assert every slice name resolves via ASSET_TYPE_LABEL_KEYS/TranslatePipe"
Task: "Assert a type with no computable-value holdings produces no slice; excludedCount unaffected"
```

---

## Implementation Strategy

### MVP First (and only) — User Story 1

1. Extend tests (T001–T005) to capture the new grouping/labeling behavior and confirm they fail
   against today's per-name-grouping code.
2. Implement the simplified entry shape and always-by-type grouping (T006–T009).
3. Confirm tests pass (T010).
4. **STOP and VALIDATE**: run quickstart.md's manual validation (T012) to confirm end-to-end.
5. This is the entire feature — no further stories to add.

## Notes

- [P] tasks here share one file (the spec file for T001–T004); treat "parallel" as
  "independent assertions," not literal concurrent edits, to avoid clobbering each other.
- Commit after the red state (T005) and again after the green state (T010) for a clean history.
- Avoid: reintroducing the `isNamedGroup`/per-name branch, adding new translation keys (none are
  needed — spec.md Assumptions), or touching `computeValue()`/excluded-holdings logic (FR-003/FR-004
  are explicitly unchanged).
