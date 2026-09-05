---
description: 'Task list template for feature implementation'
---

# Tasks: Per-Type Holdings Breakdown Charts

**Input**: Design documents from `/specs/023-multi-holdings-charts/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included — the constitution's Principle III/IV and the plan's Constitution Check
explicitly require exact-`Decimal` unit tests for the shared valuation/grouping module and
component-level tests for the new tile and the 6-tile grid.

**Organization**: Tasks are grouped by user story (spec.md), in priority order (P1 → P2 → P3).

## Path Conventions

All paths are under the existing Nx library `libs/frontend/domain/holdings/src/lib/`, plus one
grid-layout change in that library's page component. No `apps/*` or backend paths are touched
(per plan.md, the dashboard widget is explicitly out of scope).

---

## Phase 1: Setup

No new project/tooling setup is needed — this feature extends an existing, already-configured Nx
library (`libs/frontend/domain/holdings`) with its existing lint/test tooling. Skipped.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract the shared, exported valuation/grouping logic (Principle I) that every user
story's chart — main and per-type — depends on. **MUST complete before any user story phase.**

- [x] T001 Create `libs/frontend/domain/holdings/src/lib/holdings-valuation.ts` exporting
      `computeHoldingValue(holding: HoldingResponse): Decimal | null` (moved verbatim from
      `HoldingsDistributionComponent.computeValue` in
      `libs/frontend/domain/holdings/src/lib/holdings-distribution/holdings-distribution.component.ts`:
      `currentValue` for `PRECIOUS_METAL`/`DEPOSIT_MONEY`, `quantity * purchasePrice` for
      `ETF`/`SHARE`/`CRYPTO`, `null` if not computable) and
      `groupHoldingsByKey<K>(holdings: HoldingResponse[], keyOf: (h: HoldingResponse) => K | null): { entries: { key: K; value: Decimal }[]; excludedCount: number }`
      (sums `computeHoldingValue` per key returned by `keyOf`, skips a holding when its value or its
      `keyOf` result is `null` and counts it in `excludedCount`, preserves first-seen key order per
      data-model.md)
- [x] T002 [P] Write `libs/frontend/domain/holdings/src/lib/holdings-valuation.spec.ts` with exact
      `Decimal`/`.toString()` assertions (Principle III — no tolerance/approximate assertions) covering:
      `computeHoldingValue` for each `AssetType` (both computable-value rules) and its `null` cases;
      `groupHoldingsByKey` same-key summation of two holdings, exclusion of a holding with no
      computable value (incrementing `excludedCount` without adding an entry), exclusion via `keyOf`
      returning `null`, and an empty `entries: []` result (with correct `excludedCount`) when no input
      holding has a computable value
- [x] T003 Refactor `HoldingsDistributionComponent.recompute` in
      `libs/frontend/domain/holdings/src/lib/holdings-distribution/holdings-distribution.component.ts`
      to call `groupHoldingsByKey(this.holdings, (h) => h.assetType)` from `holdings-valuation.ts`
      instead of its private `computeValue`/inline grouping loop, mapping `result.entries` to the
      existing `HoldingsDistributionEntry[]` shape and `result.excludedCount` to the existing
      `excludedCount` signal; remove the now-unused private `computeValue` static method; keep
      `centerLabel`, `chartOption`, legend, and all existing DOM/behavior unchanged (FR-001, FR-008)
- [x] T004 Run the existing
      `libs/frontend/domain/holdings/src/lib/holdings-distribution/holdings-distribution.component.spec.ts`
      suite and confirm it still passes unmodified after T003 (regression guard for FR-001/FR-008
      before building on top of the shared module)

**Checkpoint**: Shared valuation/grouping module exists, is unit-tested, and the existing main
chart already consumes it without any behavior change. User story work can now begin.

---

## Phase 3: User Story 1 - See how each asset type's value is split by holding name (Priority: P1) 🎯 MVP

**Goal**: A new `HoldingsTypeBreakdownComponent`, given an `assetType` and the full holdings list,
groups that type's own holdings by `name` (via `groupHoldingsByKey`) and renders one pie segment
per distinct name, correctly summing same-named holdings and excluding holdings with no
computable value.

**Independent Test**: Add two Precious metal holdings named "Gold" and "Silver" (plus a second
"Gold"), instantiate `HoldingsTypeBreakdownComponent` with `assetType="PRECIOUS_METAL"` and that
holdings list, and confirm the resulting chart data has two entries — "Gold" (summed) and "Silver"
— matching Acceptance Scenarios 1 and 2.

### Tests for User Story 1

- [x] T005 [P] [US1] Write
      `libs/frontend/domain/holdings/src/lib/holdings-type-breakdown/holdings-type-breakdown.component.spec.ts`
      (mirroring the mocking pattern in
      `holdings-distribution/holdings-distribution.component.spec.ts`: `vi.mock('echarts', ...)`,
      stubbed `ResizeObserver`) asserting: two same-type holdings with distinct `name`s produce two
      chart segments with exact `Decimal`-derived numeric values (Acceptance Scenario 1); two same-type,
      same-`name` holdings produce one summed segment (Acceptance Scenario 2, exact value assertion per
      Principle III); a holding of a _different_ `assetType` than the component's `[assetType]` input is
      never included in that instance's segments/total; a holding with no computable value is excluded
      from segments and total (FR-005)

### Implementation for User Story 1

- [x] T006 [US1] Create
      `libs/frontend/domain/holdings/src/lib/holdings-type-breakdown/holdings-type-breakdown.component.ts`:
      a presentational `HoldingsTypeBreakdownComponent` with `@Input() assetType!: AssetType` and
      `@Input() holdings: HoldingResponse[] = []` (no self-fetch — always data-bound by the holdings
      page, per research.md #2), computing
      `result = computed(() => groupHoldingsByKey(this.holdings.filter((h) => h.assetType === this.assetType), (h) => h.name))`
      and `hasData = computed(() => result().entries.length > 0)`, gating an `@if (hasData())`/`@else`
      template analogous to `HoldingsDistributionComponent`'s (empty branch reuses the
      `holdingsDistribution.emptyState` translation key per research.md #6)
- [x] T007 [US1] In the same component, build the `chartOption` pie `series.data` from
      `result().entries` — `name: entry.key` (the holding name, used as-is, no translation lookup since
      names are user-entered), `value: entry.value.toNumber()` (Decimal → number only at this
      presentation boundary, per data-model.md) — satisfying FR-003/FR-004
- [x] T008 [US1] Ensure T006's `groupHoldingsByKey` call and `computeHoldingValue` (transitively,
      inside `holdings-valuation.ts`) apply the exact same per-`assetType` value rule as the main chart
      (FR-004) — no new value-computation logic in this component; run T005 to confirm

**Checkpoint**: `HoldingsTypeBreakdownComponent` correctly groups-and-sums by name per asset type,
independently testable, with the main chart (Phase 2) still unaffected.

---

## Phase 4: User Story 2 - Inspect a specific holding's value without visual clutter (Priority: P2)

**Goal**: Type-specific chart tiles render no legend and no centered total label; a segment's
name, value, and percentage are revealed only via tooltip on hover/focus.

**Independent Test**: Render `HoldingsTypeBreakdownComponent` with several same-type holdings,
confirm the rendered `EChartsOption` has no `legend` key and the template has no centered-label
element, then simulate the tooltip formatter and confirm it returns the name, formatted value, and
percentage.

### Tests for User Story 2

- [x] T009 [P] [US2] Extend
      `holdings-type-breakdown.component.spec.ts` asserting: the built `chartOption` has no `legend`
      property (FR-007); the rendered template contains no center-label element (unlike
      `holdings-distribution.component.spec.ts`'s equivalent assertion for the main chart, per FR-008);
      the pie series' `tooltip`/label `formatter` output for a segment includes its name, its
      currency-formatted value, and its percentage (SC-004)
- [x] T010 [P] [US2] Extend
      `holdings-distribution/holdings-distribution.component.spec.ts` (or confirm existing coverage) to
      assert the main chart's `chartOption` still includes `legend` and its center-label element still
      renders, unaffected by T009's changes to the sibling component (FR-008, Acceptance Scenario 3)

### Implementation for User Story 2

- [x] T011 [US2] In
      `holdings-type-breakdown.component.ts`, omit `legend` entirely from the `chartOption`
      `EChartsOption` and omit any centered-total overlay element from the template (research.md #3);
      set `tooltip: { trigger: 'item', formatter: ... }` mirroring
      `HoldingsDistributionComponent.chartOption`'s tooltip formatter (name, `Intl.NumberFormat`
      currency-formatted value, `percent`) so hover behavior matches the main chart (SC-004)
- [x] T012 [US2] Apply per-name segment coloring in `holdings-type-breakdown.component.ts` using the
      existing generic theme palette already applied by `app-echart`/`chart-palette.ts` (NOT
      `ASSET_TYPE_COLORS`, which is keyed by asset type and has only 5 entries — research.md #4),
      satisfying FR-011's "distinguishable within this chart" requirement without introducing a new
      color scheme
- [x] T013 [US2] Verify (manually or via T009) that a type tile with 15+ distinctly-named holdings
      renders at the same visual footprint (no legend/list added) as one with 2 holdings — SC-002; no
      code change expected beyond T011 if no legend/list is ever added

**Checkpoint**: Type-specific tiles are legend-free and center-label-free with tooltip-only detail;
the main chart (Phase 2/3) is verified unaffected.

---

## Phase 5: User Story 3 - See all six charts arranged for easy scanning (Priority: P3)

**Goal**: The holdings page renders all 6 tiles together — the existing main chart plus one
`HoldingsTypeBreakdownComponent` per `ASSET_TYPES` entry, in that fixed order — in a 3-column grid
that reflows to fewer columns on narrow viewports.

**Independent Test**: Open the holdings page on a wide viewport and confirm 6 tiles appear 3-per-row
in fixed order (main, ETF, Share, Precious metal, Crypto, Deposit money); narrow the viewport and
confirm the tiles reflow without clipping or horizontal scroll.

### Tests for User Story 3

- [x] T014 [P] [US3] Extend `libs/frontend/domain/holdings/src/lib/holdings.component.spec.ts`
      (`HttpTestingController`-backed, per plan.md's Integration Testing requirement) with a fixture
      spanning multiple asset types and repeated names, asserting: all 6 chart tiles render (1
      `app-holdings-distribution` + 5 `app-holdings-type-breakdown` instances); the 5 type-breakdown
      instances appear in `ASSET_TYPES` order (ETF, Share, Precious metal, Crypto, Deposit money,
      FR-010); each type-breakdown instance receives the full `holdings()` list as its `[holdings]`
      input (filtering happens inside the component, per T006) and the correct `[assetType]`;
      a type with zero holdings still renders its tile (empty-state branch) at the same fixed
      grid position (Edge Cases, FR-002)

### Implementation for User Story 3

- [x] T015 [US3] In `libs/frontend/domain/holdings/src/lib/holdings.component.ts`, import
      `HoldingsTypeBreakdownComponent` and `ASSET_TYPES` (from `./asset-type-fields`), replace the
      existing single `<p-card>...<app-holdings-distribution [holdings]="holdings()" /></p-card>` block
      with a `.card-row`-style grid container wrapping 6 tiles: the existing main-chart card first,
      then `@for (assetType of assetTypes; track assetType) { <app-holdings-type-breakdown [assetType]="assetType" [holdings]="holdings()" /> }`
      over `protected readonly assetTypes = ASSET_TYPES;` (FR-002, FR-009, FR-010)
- [x] T016 [US3] Add a `.holdings-charts-grid` CSS rule to `holdings.component.ts`'s inline
      `styles`, copying the reflow pattern from
      `apps/frontend/src/app/dashboard/dashboard.component.css:5-16`
      (`display: grid; grid-template-columns: repeat(3, 1fr); gap: ...;` collapsing to `1fr` under the
      same `max-width: 768px` media query) so the 6 tiles lay out 3-per-row and reflow to 1-per-row on
      narrow viewports without clipping or horizontal scroll (FR-009, research.md #5)
- [x] T017 [US3] Wrap each of the 5 new tiles (and, for consistency, the existing main-chart tile)
      in a small card/container matching the existing `.distribution-card` styling so all 6 tiles share
      a consistent visual frame inside the new grid

**Checkpoint**: All 6 tiles render together in fixed order, reflow correctly, and the holdings page
integration test (T014) passes — all three user stories are now independently verifiable end to
end.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup after all three user stories are implemented.

- [x] T018 [P] Run `npm exec nx lint frontend-domain-holdings` and `npm exec nx test
frontend-domain-holdings` and fix any lint/type errors introduced across T001–T017
- [ ] T019 Manually execute the full validation checklist in
      `specs/023-multi-holdings-charts/quickstart.md` (seed data per its table, verify all 9 numbered
      checks) against `npm exec nx serve frontend` + a running backend
- [x] T020 Confirm `apps/frontend/src/app/dashboard/dashboard-widgets.registry.ts` is unmodified and
      the Dashboard page still renders only the single existing main-chart widget (quickstart.md
      validation step 9, plan.md's explicit dashboard-unaffected constraint)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies (Setup phase skipped) — BLOCKS all user stories;
  T001 → T002 (tests need the module) → T003 → T004 (regression check needs T003 done)
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion (needs `holdings-valuation.ts`) — T005
  before T006–T008 (write the failing tests first); no dependency on US2/US3
- **User Story 2 (Phase 4)**: Depends on Phase 2 and Phase 3 (extends the component T006 created);
  T009/T010 before T011–T013
- **User Story 3 (Phase 5)**: Depends on Phase 2, 3, and 4 (wires the finished tile component into
  the page); T014 before T015–T017
- **Polish (Phase 6)**: Depends on all of Phase 2–5 being complete

### User Story Dependencies

Unlike a typical fully-parallel set of user stories, US1 → US2 → US3 here form a linear chain
because each phase builds directly on the same single new component
(`HoldingsTypeBreakdownComponent`) the previous phase created — matching the incremental,
single-component nature of this feature. Each phase's own acceptance scenarios remain
independently testable once reached (per each phase's "Independent Test" above).

### Parallel Opportunities

- T002 can be written in parallel with finishing T001 (different file), though it will only pass
  once T001 lands
- T005, T009, T010, T014 (test-file work) are each `[P]` relative to other same-phase test tasks
  in different files
- T018 (lint/test) has no file overlap with T019/T020 and can run in parallel with them

---

## Parallel Example: Foundational Phase

```bash
Task: "Create holdings-valuation.ts with computeHoldingValue and groupHoldingsByKey"
Task: "Write holdings-valuation.spec.ts with exact-Decimal assertions"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (shared valuation/grouping module + main-chart refactor)
2. Complete Phase 3: User Story 1 (new per-type chart component, correct grouping/summation)
3. **STOP and VALIDATE**: Render `HoldingsTypeBreakdownComponent` standalone (e.g. in a spec or a
   temporary page binding) and confirm per-name segments and sums are correct
4. This alone doesn't yet satisfy FR-007 (no legend) or wire the component into the holdings page
   — Phase 4 and 5 are needed for a user-visible, spec-complete increment

### Incremental Delivery

1. Foundational → shared module ready, main chart unaffected
2. Add User Story 1 → per-type grouping/summation correct (not yet legend-free, not yet on-page)
3. Add User Story 2 → per-type tiles are legend-free/tooltip-only (still not on-page)
4. Add User Story 3 → all 6 tiles wired into the holdings page grid, reflowing correctly — first
   point at which the feature is actually visible/demoable end to end
5. Polish → lint/test/quickstart validation, dashboard-unaffected confirmation

---

## Notes

- [P] tasks = different files, no dependencies within their phase
- [Story] label maps task to specific user story for traceability
- Commit after each task or logical group (see extension hooks — `after_tasks`/`after_implement`
  auto-commit is configured for this repo)
- Verify tests fail before implementing (T005, T009, T010, T014 before their implementation tasks)
- No `[P]` marker on any task that edits `holdings-type-breakdown.component.ts` or
`holdings.component.ts` more than once across a phase — those are intentionally sequential to
avoid same-file conflicts
</content>
