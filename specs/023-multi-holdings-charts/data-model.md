# Phase 1 Data Model: Per-Type Holdings Breakdown Charts

No persisted schema changes. This feature introduces no new database table/column and no new API
DTO — it derives view-model data, entirely client-side, from the existing `HoldingResponse[]`
already returned by `GET /holdings` (consumed today by `HoldingsService` /
`HoldingsDistributionComponent`). The entities below are frontend view-model shapes only, produced
by the shared valuation/grouping module introduced in [research.md](./research.md) #1.

## Existing entity (unchanged, referenced)

### Holding (`HoldingResponse`, from `@vaultfolio/api-contract`)

Relevant fields this feature reads (no new fields required):

| Field           | Type             | Used for                                                                                                    |
| --------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `assetType`     | `AssetType`      | Selects which of the 5 type-specific charts a holding contributes to; sole grouping key for the main chart. |
| `name`          | `string`         | Grouping key **within** a type-specific chart (FR-003).                                                     |
| `currentValue`  | `string \| null` | Computed value source for `PRECIOUS_METAL` / `DEPOSIT_MONEY` (FR-004).                                      |
| `quantity`      | `string \| null` | Computed value source (× `purchasePrice`) for `ETF` / `SHARE` / `CRYPTO` (FR-004).                          |
| `purchasePrice` | `string \| null` | Computed value source (× `quantity`) for `ETF` / `SHARE` / `CRYPTO` (FR-004).                               |

## New view-model types (frontend-only, `holdings-valuation.ts`)

### `GroupedValueEntry<K>`

One aggregated segment — used by both the main chart (`K = AssetType`) and each type-specific
chart (`K = string`, the holding `name`).

| Field   | Type      | Notes                                                                                                                                                                                        |
| ------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`   | `K`       | The grouping key: `assetType` for the main chart, `name` for a type chart.                                                                                                                   |
| `value` | `Decimal` | Sum of `computeHoldingValue(...)` for every holding sharing this key within scope (FR-003, FR-004). Exact decimal, never a native `number`, until the presentation boundary (Principle III). |

**Validation / derivation rules** (identical to the existing main chart's, extended to the `name`
key per FR-003–FR-005):

- A holding with no computable value (`computeHoldingValue` returns `null`) contributes to
  neither the segment list nor its scope's total, and increments a shared `excludedCount` — this
  count is portfolio-wide across all 6 charts' combined exclusions, matching today's single
  excluded-holdings count (Edge Cases).
- Two holdings sharing the same grouping key (same `assetType`, or — within one type-specific
  chart — same `name`) collapse into one `GroupedValueEntry` whose `value` is their summed
  `Decimal` (FR-003, Edge Cases: "same name are combined into one segment, summed").
- Grouping key order follows first-seen order in the source `HoldingResponse[]` for the main
  chart (existing behavior, unchanged); for a type-specific chart, ECharts renders the resulting
  segments in whatever order `groupHoldingsByKey` returns them — no specific segment order is
  required by the spec (only the tooltip content is specified, FR-007/SC-004).

### `GroupedValueResult<K>`

The full result of one grouping pass, returned by `groupHoldingsByKey`.

| Field           | Type                     | Notes                                                                                                 |
| --------------- | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `entries`       | `GroupedValueEntry<K>[]` | Empty array when no holding in scope has a computable value — drives the empty-state branch (FR-006). |
| `excludedCount` | `number`                 | Count of holdings in scope excluded for lacking a computable value.                                   |

### Per-type chart tile state (component-local, `HoldingsTypeBreakdownComponent`)

Not persisted or exported — mirrors the existing `HoldingsDistributionComponent`'s internal
`entries`/`hasData` signal pattern, scoped to one `assetType`:

- **Input**: `assetType: AssetType`, `holdings: HoldingResponse[]` (the full portfolio list; the
  component filters to its own `assetType` internally via `groupHoldingsByKey(holdings.filter(h => h.assetType === assetType), h => h.name)`).
- **Derived**: `result = computed(() => groupHoldingsByKey(...))`; `hasData = computed(() =>
result().entries.length > 0)`, gating the empty-state branch (FR-006) exactly like the existing
  main chart's `hasData`/`entries` pattern.
- **Presentation boundary**: `EChartsOption` built from `result().entries`, converting each
  `Decimal` to `.toNumber()` only at this final step (consistent with the main chart's existing
  convention, per its own `HoldingsDistributionEntry.value: number` comment).

## State Transitions

None — this is a pure, synchronous, re-computed-on-input-change view (Angular `computed()` /
`ngOnChanges`), identical in nature to the existing main chart. There is no multi-step workflow or
persisted state machine introduced by this feature.
