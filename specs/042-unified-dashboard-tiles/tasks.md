# Tasks: Unified Dashboard Tiles

**Input**: Design documents from `/specs/042-unified-dashboard-tiles/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dashboard-tile-frame.md, design.md, mockup.html

**Tests**: Included. The constitution requires coverage for changed code and the plan lists component, store and widget tests.

**Organization**: Grouped by user story. Frontend-only; no backend, API or database changes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1, US2, US3 (maps to spec.md)

## Path Conventions

- Shared UI: `libs/frontend/shared-ui/src/lib/`
- Domain widgets: `libs/frontend/domain/<domain>/src/lib/<widget>/`
- App dashboard: `apps/frontend/src/app/dashboard/`

---

## Phase 1: Setup

**Purpose**: Translations and design tokens every later task needs

- [x] T001 [P] Add `dashboard.tile.showDetails` and `dashboard.tile.hideDetails` to `libs/frontend/shared-ui/src/lib/i18n/translations/en.ts` and `libs/frontend/shared-ui/src/lib/i18n/translations/de.ts`
- [x] T002 [P] Add the shared tile sizing values (`--tile-min-height: 14rem`, `--tile-value-size: 1.5rem`, `--tile-chart-height: 3.25rem`) as defaults on the frame host in the component created in T005

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared frame, value component and expansion token that every widget and the dashboard build on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create the expansion token `DASHBOARD_TILE_EXPANSION` and `DashboardTileExpansion` interface in `libs/frontend/shared-ui/src/lib/dashboard-tile/dashboard-tile-expansion.token.ts` (see contracts/dashboard-tile-frame.md)
- [x] T004 [P] Create `app-tile-value` (common headline-amount size, bold, tabular numerals, no overflow) in `libs/frontend/shared-ui/src/lib/dashboard-tile/tile-value.component.ts`
- [x] T005 Create `app-dashboard-tile` in `libs/frontend/shared-ui/src/lib/dashboard-tile/dashboard-tile.component.ts`: header (title, optional link with `linkTestId`), default slot, `[tileChart]` slot always occupying the fixed chart zone, `[tileDetails]` slot rendered only while expanded, toggle button (`aria-expanded`, `aria-controls`, `<testIdPrefix>-toggle`, details region `<testIdPrefix>-details`) shown only when a details slot is projected, expanded state from `DASHBOARD_TILE_EXPANSION` or a local signal fallback, minimum height from the CSS custom properties
- [x] T006 Export `DashboardTileComponent`, `TileValueComponent`, `DASHBOARD_TILE_EXPANSION` and `DashboardTileExpansion` from `libs/frontend/shared-ui/src/index.ts`
- [x] T007 [P] Component tests for the frame in `libs/frontend/shared-ui/src/lib/dashboard-tile/dashboard-tile.component.spec.ts`: collapsed by default, no toggle without details, toggle shows/hides details and flips `aria-expanded`, keyboard activation, uses the token when provided, local fallback when not
- [x] T008 [P] Component test for `app-tile-value` in `libs/frontend/shared-ui/src/lib/dashboard-tile/tile-value.component.spec.ts`

**Checkpoint**: Frame is usable by widgets; user story work can begin

---

## Phase 3: User Story 1 - Consistent, scannable tiles (Priority: P1) MVP

**Goal**: Every filled tile uses the shared frame with one amount size, minimum height, a single header and details collapsed by default.

**Independent Test**: Open the dashboard with all domains filled; all headline amounts have the same computed size, every tile is at least the minimum height, and no tile shows details by default.

### Implementation for User Story 1

- [x] T009 [P] [US1] Migrate `libs/frontend/domain/holdings/src/lib/holdings-total-value/holdings-total-value.component.ts` to the frame (header and minimum height only, no details; keeps its existing placeholder content)
- [x] T010 [P] [US1] Migrate `libs/frontend/domain/holdings/src/lib/holdings-distribution/holdings-distribution.component.ts` to the frame: chart in `[tileChart]`, type breakdown and excluded-holdings note in `[tileDetails]`
- [x] T011 [P] [US1] Migrate `libs/frontend/domain/earnings/src/lib/earnings-dashboard-widget/earnings-dashboard-widget.component.ts`: gross amount via `app-tile-value`, net and change as sub line, bar chart in `[tileChart]`, KPI list, growth, monthly average and data-check hint in `[tileDetails]`; keep existing `data-testid`s
- [x] T012 [P] [US1] Migrate `libs/frontend/domain/retirement/src/lib/retirement-dashboard-widget/retirement-dashboard-widget.component.ts`: expected monthly via `app-tile-value`, guaranteed/additional bar in `[tileChart]`, start date, guaranteed, savings and legend in `[tileDetails]`
- [x] T013 [P] [US1] Migrate `libs/frontend/domain/insurances/src/lib/insurances-dashboard-widget/insurances-dashboard-widget.component.ts`: monthly amount via `app-tile-value`, yearly and next-due sub lines, split bar in `[tileChart]`, legend, active count and coverage gaps in `[tileDetails]`
- [x] T014 [P] [US1] Migrate `libs/frontend/domain/historic-wealth-development/src/lib/wealth-dashboard-widget/wealth-dashboard-widget.component.ts`: net worth via `app-tile-value`, as-of and change sub lines, composition bar in `[tileChart]`, legend, assets and liabilities in `[tileDetails]`
- [x] T015 [P] [US1] Migrate `libs/frontend/domain/account-overview/src/lib/account-overview-dashboard-widget/account-overview-dashboard-widget.component.ts`: account count via `app-tile-value`, category counts and decommissioned note in `[tileDetails]`
- [x] T016 [US1] Remove the card `header` from `apps/frontend/src/app/dashboard/dashboard.component.html` (frame renders the header) and give the card the shared minimum height and flex column layout in `apps/frontend/src/app/dashboard/dashboard.component.css`; keep drag handle and its `aria-label`
- [x] T017 [P] [US1] Update widget specs for the migrated structure (details are not rendered while collapsed; tests reading detail values expand first): `earnings-dashboard-widget.component.spec.ts`, `retirement-dashboard-widget.component.spec.ts`, `insurances-dashboard-widget.component.spec.ts`, `wealth-dashboard-widget.component.spec.ts`, `account-overview-dashboard-widget.component.spec.ts` in their widget folders
- [x] T018 [US1] Update `apps/frontend/src/app/dashboard/dashboard.component.spec.ts` for the header change and add an assertion that all rendered headline amounts share one frame and that no details are visible initially

**Checkpoint**: User Story 1 is complete and independently verifiable (uniform tiles, collapsed by default)

---

## Phase 4: User Story 2 - Expand and collapse tile details (Priority: P1)

**Goal**: Members expand/collapse details per tile; the row stretches while neighbours keep their details collapsed; the state survives reload.

**Independent Test**: Expand one tile; its details show, neighbours match the height without details, collapse restores the height, reload keeps the state.

### Implementation for User Story 2

- [x] T019 [P] [US2] Extend `DashboardLayout` with optional `expanded: string[]` and update `parseDashboardLayout` (default `[]`, drop non-strings) in `apps/frontend/src/app/dashboard/dashboard-layout.ts`
- [x] T020 [US2] In `apps/frontend/src/app/dashboard/dashboard-layout.store.ts` add `isExpanded(id)` / `setExpanded(id, expanded)` backed by the layout signal and `localStorage`, keep `expanded` when reordering or hiding/showing tiles, clear it in `reset()`, leave `isCustomized` unchanged
- [x] T021 [US2] Provide `DASHBOARD_TILE_EXPANSION` from `DashboardLayoutStore` in the dashboard component (`apps/frontend/src/app/dashboard/dashboard.component.ts`)
- [x] T022 [US2] Make each widget pass its stable tile id to `app-dashboard-tile` (`tileId` input equals its contribution `id` from `apps/frontend/src/app/dashboard/dashboard-widgets.registry.ts`) in the seven widget components from T009-T015
- [x] T023 [P] [US2] Layout parser tests (missing/invalid/duplicate `expanded`) in `apps/frontend/src/app/dashboard/dashboard-layout.spec.ts`
- [x] T024 [P] [US2] Store tests (expand, collapse, persists across a new store instance, kept on reorder/hide, cleared on reset, per-user key) in `apps/frontend/src/app/dashboard/dashboard-layout.store.spec.ts`
- [x] T025 [US2] Dashboard component test: expanding one tile reveals only its own details and persists after re-creating the component, in `apps/frontend/src/app/dashboard/dashboard.component.spec.ts`
- [x] T026 [US2] Verify row stretching and neighbour behaviour in the grid CSS (`apps/frontend/src/app/dashboard/dashboard.component.css`, frame styles): toggle stays directly under the main content, spare height below, mobile single column

**Checkpoint**: User Stories 1 and 2 work independently and together

---

## Phase 5: User Story 3 - All existing tile states keep working (Priority: P2)

**Goal**: Loading, empty, unavailable and maintenance states use the same frame; reordering and hide/show are unchanged.

**Independent Test**: Put a domain into maintenance, view an empty and an unavailable tile, reorder and hide/show tiles.

### Implementation for User Story 3

- [x] T027 [P] [US3] Render `app-empty-tile` inside the frame header/minimum height in `libs/frontend/shared-ui/src/lib/empty-tile/empty-tile.component.ts` and pass the tile title from the seven widgets' empty states
- [x] T028 [P] [US3] Render unavailable/error text of each widget inside the frame (header with the tile's `titleKey` translation, minimum height, no toggle) in the seven widget components
- [x] T029 [US3] Render the maintenance tile and admin badge with the frame header and minimum height in `apps/frontend/src/app/dashboard/dashboard.component.html` and `libs/frontend/shared-ui/src/lib/maintenance/maintenance-tile.component.ts`
- [x] T030 [P] [US3] Update `libs/frontend/shared-ui/src/lib/maintenance/maintenance-tile.component.spec.ts` and add an empty-tile spec for the new layout
- [x] T031 [US3] Regression test in `apps/frontend/src/app/dashboard/dashboard.component.spec.ts`: reorder via keyboard, hide/show via the edit dialog and maintenance display still work with the new frame

**Checkpoint**: All user stories are independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T032 Delete `libs/frontend/shared-ui/src/lib/widget-header/` and its export from `libs/frontend/shared-ui/src/index.ts` once no widget uses it; run `npx knip` to confirm no dead code
- [x] T033 [P] Add the new test ids (`<prefix>-toggle`, `<prefix>-details`) to `docs/frontend/testid-conventions.md` if it keeps a registry of shared components
- [x] T034 [P] Update the dashboard sections of `docs/user-guide.md` and `docs/user-guide.de.md` (details toggle, remembered state) via `speckit-docs-update`
- [x] T035 Run `npx nx affected -t lint,typecheck,test` and fix findings
- [x] T036 Run the scenarios in quickstart.md with Playwright via the `verify-ui` skill (light and dark theme, German and English, desktop and 400px width) and fix visual deviations from mockup.html
- [ ] T037 Run `speckit-sonar-local` / `speckit-sonar-validate` and resolve issues

---

## Dependencies & Execution Order

- Phase 1 has no dependencies; T002 depends on T005 only for its file location and can be merged into T005.
- Phase 2 blocks everything: T003 and T004 first, then T005 (uses both), then T006; T007/T008 after T005.
- US1 (Phase 3) depends on Phase 2. T009-T015 are independent of each other; T016 can run in parallel with them; T017 follows the widget it covers; T018 follows T016.
- US2 (Phase 4) depends on Phase 2 and on the widgets from US1 for T022; T019 → T020 → T021; T023/T024 follow T019/T020; T025 follows T021 and T022.
- US3 (Phase 5) depends on Phase 2; T027-T030 touch separate files; T031 last.
- Polish (Phase 6) after all stories; T032 only after every widget is migrated.

## Parallel Examples

```text
After T006:   T009, T010, T011, T012, T013, T014, T015, T016   (separate widget files)
After T020:   T023 and T024                                      (separate spec files)
Phase 5:      T027, T028, T030                                   (separate files)
```

## Implementation Strategy

1. **MVP**: Phases 1-3 (frame + all widgets migrated, collapsed by default). The toggle already works with the local fallback state, so the dashboard is shippable here.
2. **Increment 2**: Phase 4 adds persistence per user and grid behaviour checks.
3. **Increment 3**: Phase 5 brings every edge state into the same frame.
4. **Finish**: Phase 6 cleanup, docs and quality gates.
