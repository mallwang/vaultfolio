# Contract: `app-echart` (`EchartComponent`)

This is the reusable "UI contract" FR-009 requires: the documented pattern any future chart in
the app is expected to use. It's an Angular component contract, not an HTTP API — there is no
backend surface in this feature (Constitution Check: Principle II unaffected).

## Selector

`app-echart`

## Inputs

| Name      | Type                    | Required | Default | Description                                                                                                  |
| --------- | ----------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `option`  | `echarts.EChartsOption` | Yes      | —       | A complete ECharts option object (series, tooltip, legend, grid, etc.) that the caller builds and localizes. |
| `loading` | `boolean`               | No       | `false` | When `true`, the component shows ECharts' built-in loading overlay instead of applying `option` (FR-007).    |

## Behavior guarantees

1. **Theming (FR-004)**: The component injects `ThemeService` and, on every `ThemeService.theme()`
   change, re-applies `resolveChartPalette(theme)` (research.md #3) to the live chart instance via
   `setOption` — colors update without the caller having to rebuild `option`.
2. **Responsiveness (FR-005)**: The component observes its host element via `ResizeObserver` and
   calls the underlying ECharts instance's `resize()` on every size change (container resize,
   sidebar collapse, viewport resize) — no fixed pixel dimensions are assumed.
3. **Localization (FR-008)**: The component does not localize any strings itself — all
   caller-visible text (series names, tooltip formatters, legend labels) comes from the `option`
   the caller supplies, so it is only as localized as that `option`. Callers MUST route any label
   text through `TranslatePipe`/`I18nService` before constructing `option`, and MUST rebuild
   `option` when `I18nService.language()` changes (see `HoldingsDistributionComponent` for the
   reference implementation).
4. **Loading (FR-007)**: When `loading` is `true`, `option` is not applied to the chart; ECharts'
   `showLoading()` overlay (themed via the same `resolveChartPalette`) is shown instead. When
   `loading` transitions back to `false`, `hideLoading()` is called and `option` is applied.
5. **Empty state**: This component has no built-in empty-state rendering — it always assumes
   `option` describes a chart to draw. Callers are responsible for not rendering `<app-echart>` at
   all (or passing an explicit "no data" `option`) when there is nothing to chart, matching
   `HoldingsDistributionComponent`'s existing `@if (hasData())` pattern.
6. **Lifecycle**: The ECharts instance is created once after the host view is initialized and is
   always `dispose()`d in `ngOnDestroy` to avoid leaking canvas/WebGL resources across
   navigations.

## Non-goals (for this migration)

- No `@Output()` events are defined yet — no current caller consumes chart interaction events
  (click/hover) beyond ECharts' own built-in tooltip. Future callers needing e.g. `(sliceClick)`
  should extend this contract, not create a second wrapper.
- No support for chart types beyond what `option` itself expresses — the component is a generic
  ECharts host, not a chart-type-specific abstraction (keeps it usable for the doughnut today and
  any other ECharts series type later, per FR-009).
