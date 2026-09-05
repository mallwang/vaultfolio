# Quickstart: Per-Type Holdings Breakdown Charts

Validation guide for this feature once implemented. See [data-model.md](./data-model.md) for the
exact grouping/valuation rules and [research.md](./research.md) for the design decisions being
validated below.

## Prerequisites

- Repo installed per root `README.md` (npm, not pnpm — see project memory); full stack runnable
  via `docker-compose up` or the frontend dev server alone (`apps/frontend`) against a running
  backend, per the constitution's Stack Decision.
- A logged-in user account with access to the Holdings domain.
- At least a few holdings already entered manually (or importable via the existing CSV/JSON
  import), spanning more than one asset type and, within at least one type, more than one distinct
  `name` and at least one repeated `name`.

## Setup: seed representative data

Enter (or import) holdings covering the scenarios the spec's acceptance criteria call out:

| Asset Type     | Name                                                                   | Notes                                                                                      |
| -------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Crypto         | Bitcoin                                                                | Distinct name — its own segment.                                                           |
| Crypto         | Ethereum                                                               | Distinct name — its own segment.                                                           |
| Precious metal | Gold                                                                   | First of two same-named holdings.                                                          |
| Precious metal | Gold                                                                   | Second — MUST combine with the above into one summed segment (Acceptance Scenario 2).      |
| Share          | (15 distinct names)                                                    | Exercises the "many segments, same footprint" requirement (Acceptance Scenario 4, SC-002). |
| ETF            | _(none)_                                                               | Leave empty — exercises the empty-state tile (Acceptance Scenario 3, FR-006).              |
| Deposit money  | _(none)_                                                               | Leave empty — same as above, second empty-state tile.                                      |
| Any type       | _(one holding with quantity/purchasePrice or currentValue left blank)_ | Exercises the excluded-holding path (FR-005).                                              |

## Run

```bash
npm exec nx serve frontend
npm exec nx serve backend   # or via docker-compose, per the constitution's Stack Decision
```

Navigate to the Holdings page (`/app/holdings` — NOT the Dashboard; per this feature's scope, the
6-chart grid is holdings-page-only, see [plan.md](./plan.md) Project Structure).

## Validate

1. **Main chart unchanged** (FR-001, FR-008): confirm the top-level-by-type chart still shows its
   legend and centered total exactly as before this feature.
2. **All 6 tiles present, fixed order** (FR-002, FR-009, FR-010, SC-003): confirm 6 tiles render
   together — main chart first, then ETF, Share, Precious metal, Crypto, Deposit money in that
   fixed order — arranged 3-per-row/2-rows on a wide viewport.
3. **Per-name grouping and summation** (FR-003, Acceptance Scenario 1 & 2): confirm the Crypto tile
   shows 2 segments ("Bitcoin", "Ethereum"); confirm the Precious metal tile shows exactly 1 "Gold"
   segment whose value equals the sum of the two seeded Gold holdings.
4. **No legend / no centered label, many segments same footprint** (FR-007, Acceptance Scenario 4,
   SC-002): confirm none of the 5 type tiles render a legend or centered total text; confirm the
   Share tile (15 names) renders at the same visual size as the Crypto tile (2 names).
5. **Hover reveals detail** (FR-007, SC-004): hover a segment in any type tile; confirm a tooltip
   shows that segment's name, value, and percentage of the type's total, appearing on a single
   hover/tap.
6. **Empty-state tiles** (FR-006, Acceptance Scenario 3): confirm the ETF and Deposit money tiles
   (seeded with no holdings) show the existing empty-state text treatment, not a blank chart, and
   still occupy their fixed grid position.
7. **Excluded holding** (FR-005): confirm the holding with a missing computable value does not
   appear as a segment in its type's tile and is not counted in that tile's total.
8. **Reflow on narrow viewport** (FR-009, Acceptance Scenario 3 under User Story 3): resize the
   browser (or use device emulation) below the grid's 3-column breakpoint; confirm the 6 tiles
   reflow to fewer per row with no clipping and no horizontal page scroll.
9. **Dashboard unaffected**: open the Dashboard and confirm only the single existing main chart
   widget appears there — no new type-specific tiles on the dashboard.

## Automated coverage (see plan.md Constitution Check)

- `holdings-valuation.spec.ts`: exact-`Decimal` unit tests for `computeHoldingValue` and
  `groupHoldingsByKey`, covering same-key summation, exclusion, and empty-input results.
- `holdings-type-breakdown.component.spec.ts`: unit tests for the new tile component's
  `EChartsOption` construction (no `legend` key, tooltip formatter content) and empty-state
  branch, following the existing `holdings-distribution.component.spec.ts` mocking pattern
  (`vi.mock('echarts', ...)`, stubbed `ResizeObserver`).
- An integration test (existing pattern, `HttpTestingController`-backed) rendering the holdings
  page against a multi-type, repeated-name fixture and asserting all 6 tiles render with correct
  per-tile data (Principle IV).
