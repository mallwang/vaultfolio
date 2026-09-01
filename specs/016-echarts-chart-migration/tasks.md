---
description: 'Task list template for feature implementation'
---

# Tasks: ECharts Chart Migration

**Input**: Design documents from `/specs/016-echarts-chart-migration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/echart-component-api.md, quickstart.md

**Tests**: Included — plan.md's Testing section and Constitution Check (Principle III) call for unit
tests on the new chart wrapper's data/option mapping and on `HoldingsDistributionComponent`'s
updated option-building/empty-state logic.

**Organization**: Tasks are grouped by user story (spec.md P1/P2/P3) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task lists its exact file path(s)

## Path Conventions

Single Nx project touched: `apps/frontend/`. New shared component under
`apps/frontend/src/app/shared/chart/`; modified feature component under
`apps/frontend/src/app/holdings/holdings-distribution/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the `echarts` dependency the rest of the feature builds on.

- [ ] T001 [P] Add `"echarts"` to `dependencies` in root `package.json`
- [ ] T002 [P] Add `"echarts"` to `dependencies` in `apps/frontend/package.json` (required so
      `@nx/js:prune-lockfile` includes it in the production Docker image — plan.md Technical
      Context)
- [ ] T003 Run `npm install` at the repo root to resolve and lock the new `echarts` dependency,
      confirming `package-lock.json` updates cleanly

**Checkpoint**: `echarts` is installed and importable from `apps/frontend`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the reusable `EchartComponent` wrapper (contracts/echart-component-api.md) and
its theme palette — required by every user story below, since US1's independent test can't render
a chart without it, and US3's "reusable pattern" IS this component.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 [P] Create `resolveChartPalette(theme: Theme)` in
      `apps/frontend/src/app/shared/chart/chart-palette.ts`, returning `seriesColors: string[]`,
      `textColor: string`, `backgroundColor: string` for `'light'`/`'dark'` (data-model.md Chart
      Configuration; research.md #3 — fixed palette object, not `--p-*` CSS var reads)
- [ ] T005 [P] Create `apps/frontend/src/app/shared/chart/echart.component.html` — a single host
      container `<div>` element the ECharts instance mounts into (mirrors
      `apps/frontend/src/app/shared/icon/icon.component.html` co-location convention)
- [ ] T006 [P] Create `apps/frontend/src/app/shared/chart/echart.component.css` — host/container
      sized to 100% width/height so it fills its parent card (no fixed pixel dimensions, per
      contracts/echart-component-api.md Responsiveness guarantee)
- [ ] T007 Create `EchartComponent` (selector `app-echart`) in
      `apps/frontend/src/app/shared/chart/echart.component.ts`: standalone component with
      `option: EChartsOption` (required) and `loading: boolean` (default `false`) inputs; creates
      the ECharts instance via `echarts.init()` on the host element after view init
      (`afterNextRender`/`ngAfterViewInit`), applies `option` via `setOption`, and `dispose()`s the
      instance in `ngOnDestroy` (contracts/echart-component-api.md Lifecycle)
- [ ] T008 [US-shared] Wire theme reactivity into `echart.component.ts`: inject `ThemeService`, add
      an `effect()` over `theme()` that re-applies `resolveChartPalette(theme)` (T004) to the live
      instance via `setOption` without requiring the caller to rebuild `option` (contracts
      Theming guarantee; depends on T004, T007)
- [ ] T009 Wire responsiveness into `echart.component.ts`: observe the host element with a
      `ResizeObserver` and call the ECharts instance's `resize()` on every size change; disconnect
      the observer in `ngOnDestroy` alongside `dispose()` (contracts Responsiveness guarantee;
      depends on T007)
- [ ] T010 Wire the `loading` input into `echart.component.ts`: when `true`, call
      `showLoading()` (themed via `resolveChartPalette`, T004) instead of `setOption`; call
      `hideLoading()` and re-apply `option` when it transitions back to `false` (contracts
      Loading guarantee; depends on T004, T007)
- [ ] T011 [P] Unit tests for `EchartComponent` in
      `apps/frontend/src/app/shared/chart/echart.component.spec.ts`: asserts `option` is applied on
      init, `loading=true`/`false` toggles `showLoading`/`hideLoading`, a `ThemeService.theme()`
      change re-applies palette colors via `setOption`, a host resize triggers `resize()`, and
      `ngOnDestroy` calls `dispose()` (depends on T007–T010)
- [ ] T012 [P] Unit tests for `resolveChartPalette` in
      `apps/frontend/src/app/shared/chart/chart-palette.spec.ts`: asserts distinct, defined
      `seriesColors`/`textColor`/`backgroundColor` for both `'light'` and `'dark'` (depends on
      T004)

**Checkpoint**: `<app-echart [option]="..." [loading]="...">` is a fully working, tested, reusable
component — user story implementation can now begin.

---

## Phase 3: User Story 1 - Consistent, richer chart experience across the app (Priority: P1) 🎯 MVP

**Goal**: Replace the dashboard's `<p-chart type="doughnut">` with `<app-echart>`, preserving
interactivity (tooltip/legend), theme-adaptiveness, and responsiveness.

**Independent Test**: Open the dashboard allocation view; the chart renders via ECharts, responds
to hover/tap with a tooltip, legend is visible, colors flip with the light/dark toggle, and the
chart resizes cleanly on window resize — with no `<p-chart>`/Chart.js element in the DOM.

### Implementation for User Story 1

- [ ] T013 [US1] In `apps/frontend/src/app/holdings/holdings-distribution/holdings-distribution.component.ts`,
      replace the `DoughnutChartData`/`ChartDataset` shapes and `recompute()`'s Chart.js dataset
      build with the `HoldingsDistributionEntry[]` shape (data-model.md) and a `chartOption`
      computed `echarts.EChartsOption`: a `pie` series with
      `radius: ['closer-to-40%', '70%']` (doughnut look, research.md #2), `data` from
      `entries.map(({ name, value }) => ({ name, value }))`, legend positioned right (matching the
      current `plugins.legend.position: 'right'`), and colors from
      `resolveChartPalette(themeService.theme()).seriesColors` (T004) instead of the local
      `SLICE_COLORS` array (which is removed)
- [ ] T014 [US1] In the same file, inject `ThemeService` and add a reactive recompute (`effect()`
      or updated `computed()`) so `chartOption` rebuilds when `themeService.theme()` changes,
      re-coloring the pie series (depends on T013)
- [ ] T015 [US1] In
      `apps/frontend/src/app/holdings/holdings-distribution/holdings-distribution.component.html`,
      replace `<p-chart type="doughnut" [data]="..." [options]="...">` with
      `<app-echart [option]="chartOption()" />` inside the existing `@if (hasData())` block
      (depends on T013)
- [ ] T016 [US1] In `holdings-distribution.component.ts`, remove the `ChartModule` import from
      `primeng/chart` and its entry in the component's `imports` array; add `EchartComponent`
      (from `../../shared/chart/echart.component`) to `imports` instead (depends on T015)
- [ ] T017 [P] [US1] Create
      `apps/frontend/src/app/holdings/holdings-distribution/holdings-distribution.component.spec.ts`
      (or update if one already exists): asserts the built `chartOption`'s pie series `data`
      matches the expected `{ name, value }` entries grouped by `assetType` for a fixed holdings
      fixture, and that no `p-chart` element renders (depends on T013–T016)

**Checkpoint**: User Story 1 is fully functional and independently testable — the dashboard chart
renders, is interactive, theme-adaptive, and responsive via ECharts.

---

## Phase 4: User Story 2 - No visual or functional regressions after migration (Priority: P2)

**Goal**: Preserve exact category/value parity from the previous chart, and ensure empty/loading
states are shown correctly (with the empty-state message now localized, closing the pre-existing
gap noted in research.md #6).

**Independent Test**: Compare a fixed holdings data set's rendered categories/values against the
prior Chart.js version; confirm a zero-valuable-holdings account shows a localized empty-state
message instead of a blank/broken chart.

### Implementation for User Story 2

- [ ] T018 [P] [US2] Add `holdingsDistribution.emptyState` translation keys to
      `apps/frontend/src/app/core/i18n/translations/en.ts` (`'Add a holding with a known value to
    see the distribution by value.'`) and
      `apps/frontend/src/app/core/i18n/translations/de.ts` (German equivalent)
- [ ] T019 [US2] In
      `apps/frontend/src/app/holdings/holdings-distribution/holdings-distribution.component.html`,
      replace the hardcoded empty-state `<p class="distribution__empty">` text with
      `{{ 'holdingsDistribution.emptyState' | translate }}`, and add `TranslatePipe` to the
      component's `imports` in `holdings-distribution.component.ts` (depends on T018)
- [ ] T020 [P] [US2] Add a data-parity unit test in
      `holdings-distribution.component.spec.ts`: given a fixed multi-`assetType` holdings fixture,
      assert `chartOption`'s series values equal the same Decimal totals the pre-migration
      Chart.js `dataset.data` would have produced (same grouping/exclusion rule — `computeValue()`
      is unchanged) (depends on T013, T017)
- [ ] T021 [P] [US2] Add an empty-state unit test in `holdings-distribution.component.spec.ts`:
      given holdings with no computable value, assert `hasData()` is `false`, no `<app-echart>`
      renders, and the localized empty-state key/text is shown (depends on T019)
- [ ] T022 [US2] Confirm `<app-echart [option]="chartOption()" [loading]="false" />` explicitly
      passes `loading` in
      `apps/frontend/src/app/holdings/holdings-distribution/holdings-distribution.component.html`
      (synchronous data today, per research.md #6 — establishes the pattern for a future
      async-data chart) (depends on T015)

**Checkpoint**: User Stories 1 AND 2 both work independently — chart renders with parity data, and
empty state is correct and localized.

---

## Phase 5: User Story 3 - Foundation for future charts (Priority: P3)

**Goal**: Fully remove PrimeNG's chart module and Chart.js from the codebase so ECharts is the
sole charting library, and confirm the reusable pattern is documented.

**Independent Test**: Repo-wide search finds no `primeng/chart` or `chart.js` references outside
documentation; `contracts/echart-component-api.md` and `EchartComponent` exist as the documented
pattern for future charts.

### Implementation for User Story 3

- [ ] T023 [US3] Remove the `chart.js` entry from the root `package.json` `dependencies` (currently
      pulled in transitively via PrimeNG's chart module, unused elsewhere per research.md #7)
- [ ] T024 [US3] Run `npm install` at the repo root to update `package-lock.json` after the
      `chart.js` removal (depends on T023, and on T016 having removed the last `ChartModule`
      import)
- [ ] T025 [US3] Verify via `grep -rn "primeng/chart" apps/ libs/` and
      `grep -rn "chart.js" package.json apps/frontend/package.json` that no matches remain outside
      `specs/016-echarts-chart-migration/` documentation (quickstart.md scenario 7; depends on
      T016, T023)

**Checkpoint**: All user stories independently functional; ECharts is the sole charting library in
the codebase.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories.

- [ ] T026 [P] Run `npm exec nx lint frontend` and fix any lint findings introduced by this feature
- [ ] T027 [P] Run `npm exec nx test frontend` and confirm all new/updated specs
      (`echart.component.spec.ts`, `chart-palette.spec.ts`,
      `holdings-distribution.component.spec.ts`) pass
- [ ] T028 Run `npm exec nx build frontend` to confirm the `chart.js`/`primeng/chart` removal
      doesn't break the production build
- [ ] T029 Walk through quickstart.md's Validation scenarios 1–8 manually against
      `npm exec nx serve frontend` (render, tooltip/legend, theme toggle, resize, data parity,
      empty state, no-remnants grep, documented pattern) and note any deviation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (needs `echarts` installed to build
  `EchartComponent`) — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion (needs `<app-echart>` and
  `resolveChartPalette`).
- **User Story 2 (Phase 4)**: Depends on Foundational; T020–T022 additionally depend on User Story
  1's `chartOption`/template work (T013, T015, T017) since it extends the same component/spec
  file. Not independently deployable before US1, but independently _testable_ per its own
  acceptance criteria once both are in place.
- **User Story 3 (Phase 5)**: Depends on Foundational; T024–T025 additionally depend on US1's T016
  (last `ChartModule` import removed) to make the Chart.js removal safe.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### Within Each User Story

- Foundational: palette (T004) and component skeleton (T005–T007) before wiring behavior
  (T008–T010) before tests (T011–T012).
- US1: option-building (T013–T014) before template swap (T015) before import cleanup (T016)
  before tests (T017).
- US2: translation keys (T018) before template/pipe wiring (T019); parity/empty tests (T020–T021)
  after US1's option-building exists.
- US3: dependency removal (T023) before lockfile update (T024) before verification grep (T025).

### Parallel Opportunities

- T001, T002 (different `package.json` files) in parallel.
- T004, T005, T006 (different new files) in parallel within Foundational.
- T011, T012 (different spec files) in parallel once their subjects exist.
- T017 (US1 spec) can start once T013–T016 land; T018 (US2 translation keys) can start immediately
  in parallel with US1 work, independent of it.
- T020, T021 (different test cases in the same spec file — coordinate to avoid conflicting edits,
  or land as one combined edit) can be written in parallel by different people but merged
  carefully since they touch the same file.
- T026, T027 in parallel (lint vs. test, independent commands).

---

## Parallel Example: Foundational Phase

```bash
Task: "Create resolveChartPalette in apps/frontend/src/app/shared/chart/chart-palette.ts"
Task: "Create echart.component.html in apps/frontend/src/app/shared/chart/"
Task: "Create echart.component.css in apps/frontend/src/app/shared/chart/"
```

## Parallel Example: User Story 1 + User Story 2 setup

```bash
Task: "Replace DoughnutChartData with ECharts option building in holdings-distribution.component.ts"  # US1
Task: "Add holdingsDistribution.emptyState translation keys to en.ts and de.ts"                        # US2, independent of US1's option work
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`echarts` installed).
2. Complete Phase 2: Foundational (`EchartComponent` + `resolveChartPalette`, tested).
3. Complete Phase 3: User Story 1 (dashboard chart migrated, interactive, themed, responsive).
4. **STOP and VALIDATE**: Run quickstart.md scenarios 1–4 against `npm exec nx serve frontend`.
5. Demo if ready — this alone satisfies SC-001–SC-002 for the one chart in the app today.

### Incremental Delivery

1. Setup + Foundational → shared chart infrastructure ready.
2. Add User Story 1 → dashboard chart renders via ECharts → validate → demo (MVP!).
3. Add User Story 2 → data parity confirmed, empty state localized → validate.
4. Add User Story 3 → PrimeNG chart/Chart.js fully removed → validate (grep, build).
5. Polish → lint/test/build clean, full quickstart walkthrough.

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- This feature has no cross-user-story fan-out beyond one shared component and one modified
  component — file-level conflicts are the main coordination risk (T017/T020/T021 all touch
  `holdings-distribution.component.spec.ts`).
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
