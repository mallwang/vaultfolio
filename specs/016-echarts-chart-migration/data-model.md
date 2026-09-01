# Phase 1 Data Model: ECharts Chart Migration

This feature is presentation-only — it introduces no new persisted entities, DTOs, or API
schemas. The "entities" below are frontend-internal shapes that replace the current Chart.js
`DoughnutChartData` shape.

## Chart Configuration (shared, `EchartComponent`)

The resolved, theme-aware visual configuration `EchartComponent` applies on top of whatever
`option` its caller supplies.

| Field             | Type       | Notes                                                                                     |
| ----------------- | ---------- | ----------------------------------------------------------------------------------------- |
| `seriesColors`    | `string[]` | Palette used to color chart data points, cycled by index (replaces `SLICE_COLORS`).       |
| `textColor`       | `string`   | Applied to legend/tooltip/axis label text so it stays legible in both themes.             |
| `backgroundColor` | `string`   | Tooltip background; chart canvas itself stays transparent to inherit the card background. |

Resolved per `Theme` (`'light' | 'dark'`, from `ThemeService`) by `resolveChartPalette(theme)`
(research.md #3). Not persisted; recomputed in-memory whenever `ThemeService.theme()` changes.

## `EchartComponent` public contract (Angular component inputs/outputs)

See [contracts/echart-component-api.md](./contracts/echart-component-api.md) for the full
interface. Summary of state:

| Input     | Type                    | Required             | Notes                                                                   |
| --------- | ----------------------- | -------------------- | ----------------------------------------------------------------------- |
| `option`  | `echarts.EChartsOption` | yes                  | Caller-supplied ECharts option (series, tooltip, legend, etc.).         |
| `loading` | `boolean`               | no (default `false`) | When true, shows ECharts' built-in loading overlay instead of `option`. |

No `@Output()`s in this migration's scope (no chart-originated events are consumed by any current
caller); the contract doc notes this as an intentionally deferred extension point.

## Holdings Distribution Chart Data (replaces `DoughnutChartData`)

Built by `HoldingsDistributionComponent`, unchanged in _source_ (still derived from
`@Input() holdings: HoldingResponse[]` via the existing Decimal-based `recompute()` grouping by
`assetType`), changed in _shape_ — from a Chart.js dataset to an ECharts `option`:

```ts
// Before (Chart.js-shaped, removed)
interface DoughnutChartData {
  labels: string[];
  datasets: [{ data: number[]; backgroundColor: string[] }];
}

// After (ECharts option, built by HoldingsDistributionComponent)
interface HoldingsDistributionEntry {
  name: string; // localized asset-type label (ASSET_TYPE_LABELS, routed through I18nService)
  value: number; // Decimal total, converted via .toNumber() at the presentation boundary only
}
```

`entries: HoldingsDistributionEntry[]` maps 1:1 to the previous `labels`/`data` pair (same
grouping-by-`assetType`, same exclusion-of-unvaluable-holdings rule — `excludedCount` signal is
unchanged) and is placed into an ECharts `option.series[0].data` pie series. No new validation
rules: the existing null/exclusion checks in `computeValue()` are unchanged.

### State transitions (unchanged from current component, re-expressed for the new shape)

1. `holdings` input changes (`ngOnChanges`) → `recompute()` runs → either:
   - `totalsByType.size === 0` → `chartData` signal set to `null` → template shows the (now
     localized) empty-state message, `<app-echart>` is not rendered.
   - otherwise → `chartData` signal set to `{ entries, excludedCount }` → template renders
     `<app-echart [option]="...">` with an `option` computed from `entries` and the current
     `resolveChartPalette(themeService.theme())`.
2. `ThemeService.theme()` changes while a chart is rendered → `EchartComponent` re-applies
   `resolveChartPalette` colors via `setOption` (no data change) — see research.md #5.
3. `I18nService.language()` changes → `HoldingsDistributionComponent` reruns label resolution
   (`ASSET_TYPE_LABELS` → translated string) and rebuilds `entries`, which flows into a new
   `option` passed to `<app-echart>`.
