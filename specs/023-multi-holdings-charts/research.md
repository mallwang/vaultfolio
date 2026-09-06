# Phase 0 Research: Per-Type Holdings Breakdown Charts

No `NEEDS CLARIFICATION` markers remain in the Technical Context — the spec's own Assumptions
section already resolves every open question a research pass would otherwise raise. This document
instead records the concrete implementation decisions made while translating the spec into the
Project Structure in [plan.md](./plan.md), each grounded in the existing codebase.

## 1. Extracting shared valuation/grouping logic (Principle I)

- **Decision**: Extract the existing private `HoldingsDistributionComponent.computeValue` and
  `recompute` logic into a new exported module,
  `libs/frontend/domain/holdings/src/lib/holdings-valuation.ts`, with two pure functions:
  - `computeHoldingValue(holding: HoldingResponse): Decimal | null` — identical rules as today:
    `currentValue` for `PRECIOUS_METAL`/`DEPOSIT_MONEY`, `quantity * purchasePrice` for
    `ETF`/`SHARE`/`CRYPTO`, `null` if not computable.
  - `groupHoldingsByKey<K>(holdings: HoldingResponse[], keyOf: (h: HoldingResponse) => K | null): { key: K; value: Decimal }[] & { excludedCount: number }`
    (exact return shape decided during implementation) — sums `computeHoldingValue` per key,
    skips holdings whose value or key is `null` (counting them as excluded), preserves first-seen
    key order.
  - The existing main chart is refactored to call `groupHoldingsByKey(holdings, h => h.assetType)`;
    the new per-type chart calls `groupHoldingsByKey(holdings.filter(h => h.assetType === assetType), h => h.name)`.
- **Rationale**: Both charts must apply byte-for-byte the same "computable value" rule (FR-004,
  FR-005) and the same excluded-holdings accounting (Edge Cases: "the existing excluded-holdings
  count continues to reflect all such holdings portfolio-wide"). Leaving the logic private and
  duplicating it for the new chart would silently risk the two charts drifting out of sync after a
  future change to valuation rules — exactly the risk Principle I's library-first isolation exists
  to prevent for finance-adjacent logic.
- **Alternatives considered**:
  - _Duplicate `computeValue` inline in the new component_: rejected — violates Principle I's
    intent and creates a second place a future valuation-rule change must be applied.
  - _Move valuation logic to a new standalone Nx library_: rejected as over-scoped for this
    change — the logic is small, has exactly two consumers, both inside
    `libs/frontend/domain/holdings`, and per Principle V (YAGNI) a new library boundary needs
    justification this feature doesn't have. Revisit only if a third, unrelated consumer emerges.

## 2. Per-type chart component shape

- **Decision**: One new component, `HoldingsTypeBreakdownComponent`
  (`holdings-type-breakdown/holdings-type-breakdown.component.ts`), taking `assetType: AssetType`
  and `holdings: HoldingResponse[]` as inputs (mirroring the existing main chart's `[holdings]`
  input pattern), rendered 5 times by the holdings page — once per entry of the existing
  `ASSET_TYPES` constant (`asset-type-fields.ts`) — rather than one chart component that internally
  loops over all 5 types.
- **Rationale**: Matches the existing main chart's input-driven, presentational style (no internal
  self-fetch needed for the type-specific instances since the holdings page already holds the full
  list); keeps each tile independently testable in isolation (Principle I) with a trivial
  `[assetType]`/`[holdings]` contract; lets the grid template express the fixed 5-type order
  directly by iterating `ASSET_TYPES` (FR-010), rather than hiding that order inside the chart
  component itself.
- **Alternatives considered**:
  - _A single "all 5 types" chart component with internal `@for`_: rejected — the grid layout
    (FR-009) needs 5 independent tiles, each an independent ECharts instance (own tooltip, own
    resize behavior via the existing `app-echart` wrapper's `ResizeObserver`), not one chart
    instance that would otherwise need to render 5 canvases itself.
  - _Self-fetching per-type component (like the main chart's dashboard-widget path)_: rejected —
    unnecessary duplicate HTTP calls when the holdings page already has the full `HoldingResponse[]`
    in hand; the main chart's self-fetch path exists only for its separate dashboard-widget
    consumer, which doesn't apply here.

## 3. No legend / no centered total, tooltip-only detail (FR-007)

- **Decision**: Reuse the existing `app-echart` wrapper unchanged; the new component simply omits
  `legend` from its `EChartsOption` and omits the HTML `.distribution__center-label` overlay the
  main chart renders. Tooltip configuration mirrors the main chart's (`trigger: 'item'`, formatter
  showing name, value, percentage) so hover behavior (SC-004) is visually consistent between the
  main chart and the 5 type charts, differing only in the absence of legend/center label.
- **Rationale**: The wrapper (`libs/frontend/shared-ui/src/lib/chart/echart.component.ts`) already
  accepts an arbitrary `EChartsOption`; no wrapper change is needed — the difference between the
  main chart and a type chart is entirely in the `EChartsOption` each component builds, which is
  exactly the existing extension point.
- **Alternatives considered**: _A wrapper-level `showLegend`/`showCenterLabel` flag_ — rejected;
  unnecessary indirection (Principle V) when the caller already fully controls `option` and can
  simply not include a `legend` key.

## 4. Segment coloring for type charts (FR-011)

- **Decision**: Use ECharts' default categorical palette (or the existing generic
  `SERIES_COLORS`/`resolveChartPalette` theme palette already exported from
  `chart-palette.ts`, applied automatically by the `app-echart` wrapper) for the 5 type charts,
  rather than the fixed `ASSET_TYPE_COLORS` map (which is keyed by asset type, not holding name,
  and has only 5 entries — insufficient for a type with more than 5 distinctly-named holdings).
- **Rationale**: FR-011 explicitly permits per-chart-independent coloring since these charts show
  names, not types, and have no cross-chart color meaning to preserve; the wrapper's theme
  palette already provides a reasonably-sized, theme-aware color set with no new code.
- **Alternatives considered**: _Generate a bespoke per-name color scale_ — rejected as unnecessary
  complexity (Principle V) given FR-011 doesn't require any specific scheme, only
  distinguishability within one chart.

## 5. Grid layout for 6 tiles (FR-009, FR-010)

- **Decision**: Reuse the existing `.card-row`-style CSS Grid pattern
  (`apps/frontend/src/app/dashboard/dashboard.component.css:5-16`: `grid-template-columns:
repeat(3, 1fr)` collapsing to `1fr` under a narrow-viewport media query) inside the holdings
  page component, with 6 grid children in fixed order: the existing main chart, then one
  `HoldingsTypeBreakdownComponent` per `ASSET_TYPES` entry in that array's existing order (ETF,
  Share, Precious metal, Crypto, Deposit money).
- **Rationale**: An identical responsive 3-column-reflowing-to-1 grid pattern already exists and is
  proven in the app (dashboard); reusing it avoids introducing a new shared grid component for a
  single consumer (Principle V), while still meeting FR-009's 3-per-row / reflow requirement.
- **Alternatives considered**: _A new shared `app-tile-grid` component in `frontend-shared-ui`_ —
  deferred; worth extracting only if a third page needs the same responsive tile grid. Revisit if
  that happens.

## 6. Empty-state treatment per type tile (FR-006)

- **Decision**: Reuse the main chart's existing inline empty-state pattern (`hasData` signal
  computed from whether the grouped-entries result is empty, gating an `@if`/`@else` that renders
  a `<p class="...__empty">` translated message) rather than the heavier page-level
  icon+heading `.empty-state` card used elsewhere in the app.
- **Rationale**: A type tile with no computable-value holdings is a small, expected, and frequent
  state (Edge Cases: 3 of 5 types may show it for a typical user) — the lightweight inline-text
  treatment keeps the tile's footprint identical to a populated tile (SC-002), whereas the
  icon+heading card is sized for full-page empty states, not one grid tile among six.
- **Alternatives considered**: _Hide the tile entirely when empty_ — explicitly rejected by the
  spec (Edge Cases, FR-002): all 5 type tiles must always be present so the grid position stays
  stable.

## Summary

All decisions reuse existing library boundaries, components, constants, and CSS patterns; the only
new production code is the extracted shared valuation/grouping module and the new small per-type
chart component plus the grid wiring in the holdings page — consistent with Principle V's
simplicity mandate and Principle I's library-first isolation for the shared valuation logic.
