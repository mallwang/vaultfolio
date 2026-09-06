# Implementation Plan: Per-Type Holdings Breakdown Charts

**Branch**: `024-multi-holdings-charts` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-multi-holdings-charts/spec.md`

## Summary

The holdings view currently shows one "main chart" grouping all holdings by top-level asset
type. This feature adds five more charts — one per asset type (ETF, Share, Precious metal,
Crypto, Deposit money) — each grouping that type's own holdings by their user-entered `name` and
summing values per name. The five type charts are compact (no legend, no centered total; details
on hover only) so they stay readable even with many distinctly-named holdings, and all six charts
(main + 5) are arranged together in a fixed-order 3×2 grid that reflows on narrow viewports.

The 6-chart grid is scoped to the holdings page only (`libs/frontend/domain/holdings/src/lib/holdings.component.ts`)
— the existing dashboard widget
(`apps/frontend/src/app/dashboard/dashboard-widgets.registry.ts`) keeps rendering only the single
existing main chart, unchanged, and gains none of the 5 new type-specific tiles.

The change is entirely frontend: it reuses data already returned by the existing `GET /holdings`
endpoint, the existing per-holding value computation rules, and the existing `app-echart` ECharts
wrapper — no backend, API, or schema changes. The main implementation risk the constitution flags
is that the current per-holding value computation and type-grouping logic (`computeValue`,
`recompute`) are private to `HoldingsDistributionComponent` and would otherwise be copy-pasted for
the five new charts; this plan extracts them into shared, independently-testable functions in the
same domain library first (Principle I), then builds the new per-type chart component and grid
layout on top of that shared logic.

## Technical Context

**Language/Version**: TypeScript, Angular (frontend only for this feature — no backend/API
change)

**Primary Dependencies**: Angular signals/computed; `decimal.js` (already used for exact monetary
values, per Principle III); Apache ECharts via the existing `app-echart` wrapper
(`libs/frontend/shared-ui/src/lib/chart/echart.component.ts`) — the constitution's sole charting
library; no new dependency is introduced.

**Storage**: N/A — no schema change. Reads the same `HoldingResponse[]` already fetched via
`HoldingsService` / `GET /holdings` that the existing main chart consumes.

**Testing**: Vitest + Angular `TestBed`, following the existing pattern in
`holdings-distribution.component.spec.ts` (mocked `echarts` module, stubbed `ResizeObserver`,
`HttpTestingController` for the self-fetch path); exact-value (`Decimal`) assertions per
Principle III for all summed segment values.

**Target Platform**: Modern evergreen browsers (Angular frontend), same as the rest of the app —
no new platform surface.

**Project Type**: Frontend-only Nx library extension — no new app, no new backend module.

**Performance Goals**: Client-side grouping/rendering of six charts over an already-loaded
holdings list (typically well under 1,000 rows) must feel instantaneous (no perceptible delay
beyond the existing main chart's render time); no additional network round-trip is introduced.

**Constraints**: The five type-specific charts MUST render without a legend or centered total
label (FR-007) while the main chart's legend/centered total MUST remain unchanged (FR-008); the
6-tile grid MUST reflow without clipping or horizontal scroll on narrow viewports (FR-009); a
type with no computable-value holdings MUST show the existing empty-state treatment, not a blank
chart (FR-006), and MUST still occupy its fixed grid position (Edge Cases).

**Scale/Scope**: One existing chart component extended conceptually into six chart tiles (1
unchanged main chart + 5 new type-specific chart instances) inside one existing Nx library; one
new shared valuation/grouping module; one new grid-container piece (component or template
section) inside the holdings page.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: PASS, conditionally on this plan's design. Today `computeValue` and the
  type-grouping (`recompute`) live as private members of `HoldingsDistributionComponent`
  (`libs/frontend/domain/holdings/src/lib/holdings-distribution/holdings-distribution.component.ts:245-282`),
  which would force the new per-type charts to duplicate the exact-value-computation rules this
  feature depends on. Phase 1 extracts these into a shared, exported, independently unit-testable
  module (`holdings-valuation.ts` or similar) inside the same `libs/frontend/domain/holdings`
  library, consumed by both the existing main chart and the new per-type chart component. No new
  library is created — this is a within-library extraction, appropriate since both chart
  components are domain-holdings presentation concerns, not a distinct bounded responsibility.
- **II. API-First Interface**: PASS. No API contract changes. The feature consumes the existing
  `GET /holdings` response shape (`HoldingResponse[]`) already fetched by `HoldingsService`; all
  new grouping/aggregation happens client-side, matching how the existing main chart already
  works (per its own research.md #6, referenced in the component's doc comments).
- **III. Test Coverage**: PASS, must be honored in Phase 1/tasks. The shared valuation/grouping
  functions and the new per-type chart component MUST have tests asserting exact `Decimal` values
  for: same-name summation within a type, exclusion of holdings with no computable value, and the
  empty-state path for a type with zero computable-value holdings — no approximate/tolerance
  assertions on monetary values.
- **IV. Integration Testing**: PASS, planned for Phase 1/tasks. A component-level test renders the
  holdings page (or the new grid container) against an `HttpTestingController`-backed fixture
  covering multiple asset types and repeated names, asserting all 6 chart tiles render with correct
  per-tile data — exercising the real `HoldingResponse` JSON shape, not hand-built in-memory view
  models only.
- **V. Observability, Versioning & Simplicity**: PASS. No new abstraction beyond the one shared
  valuation/grouping module justified above; reuses the existing `app-echart` wrapper, the
  existing `ASSET_TYPE_COLORS`/`ASSET_TYPE_LABEL_KEYS` constants, and the existing `.card-row`
  CSS-grid pattern (`apps/frontend/src/app/dashboard/dashboard.component.css:5-16`) rather than
  introducing a new shared grid component. No new logging requirement — this feature computes and
  renders already-fetched data, it does not perform a new financial calculation or import that
  would need new audit context.

No violations requiring Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/023-multi-holdings-charts/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature introduces no new or changed external interface (no API
endpoint, CLI flag, or file format changes) — it is purely an internal frontend presentation
change over data already exposed by the existing `GET /holdings` contract.

### Source Code (repository root)

```text
libs/frontend/domain/holdings/src/lib/
├── holdings-distribution/                   # EXISTING — main (top-level type) chart, unchanged
│   ├── holdings-distribution.component.ts
│   └── holdings-distribution.component.spec.ts
├── holdings-valuation.ts                    # NEW — shared, exported pure functions extracted
│                                             #   from the existing private computeValue/recompute
│                                             #   logic: per-holding computed value, and grouping
│                                             #   holdings by an arbitrary key (asset type, or
│                                             #   asset type + name) with Decimal summation and an
│                                             #   excluded-count.
├── holdings-valuation.spec.ts                # NEW — exact-value unit tests for the above
├── holdings-type-breakdown/                 # NEW — one chart instance for a single asset type,
│   ├── holdings-type-breakdown.component.ts  #   parameterized by `assetType`; groups its own
│   └── holdings-type-breakdown.component.spec.ts #  holdings by `name`; no legend/centered label.
├── holdings.component.ts                     # MODIFIED — the holdings PAGE only: renders the
│                                             #   6-tile grid (existing main chart + 5
│                                             #   `holdings-type-breakdown` instances, one per
│                                             #   `ASSET_TYPES` entry), reusing/extending the
│                                             #   existing `.card-row`-style grid CSS.
└── asset-type-fields.ts                      # EXISTING — reused for ASSET_TYPES order and
                                              #   ASSET_TYPE_LABEL_KEYS; no change expected.
```

```text
apps/frontend/src/app/dashboard/dashboard-widgets.registry.ts   # NOT MODIFIED — the dashboard
                                                                  # widget keeps rendering only the
                                                                  # existing main chart; the 5 new
                                                                  # type-breakdown tiles are
                                                                  # holdings-page-only per user
                                                                  # direction, not part of this
                                                                  # feature's dashboard surface.
```

**Structure Decision**: This feature extends the existing `libs/frontend/domain/holdings` library
(`scope:frontend-domain`, per the constitution's Frontend domain libraries Stack Decision) only —
no new Nx library, app, or backend module. It adds one new shared valuation/grouping module (to
satisfy Principle I without duplicating exact-value logic) and one new small chart component
(one instance per asset type, reused 5 times), and modifies the existing holdings page component
to lay out all 6 chart tiles in a grid. The existing main chart component
(`holdings-distribution/`) is left behavioraly unchanged (FR-001/FR-008) but is refactored to call
into the new shared valuation module instead of its own private `computeValue`/`recompute`.

## Complexity Tracking

_No Constitution Check violations — this section is not needed._
