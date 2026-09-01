# Phase 0 Research: ECharts Chart Migration

## 1. Direct `echarts` vs. `ngx-echarts`

**Decision**: Depend on the `echarts` npm package directly and write one thin Angular wrapper
component (`EchartComponent`, selector `app-echart`) around its imperative `init` /
`setOption` / `resize` / `dispose` API. Do **not** add `ngx-echarts`.

**Rationale**: The app has exactly one chart today and needs exactly one integration point
(FR-009's "reusable, documented pattern"). `ngx-echarts` would add a second dependency purely to
wrap the same imperative API this repo would otherwise wrap itself, with its own version-pinning
and Angular-compatibility surface to track. A ~40-line component using `ElementRef` +
`afterNextRender`/`ngAfterViewInit`, a `ResizeObserver`, and `effect()`s over `ThemeService.theme()`
/ `I18nService.language()` gives full control over re-render timing (needed for FR-008's
theme/language-triggered re-render) with one dependency instead of two. This matches Principle V
(YAGNI: no dependency without justification over a simpler alternative).

**Alternatives considered**:

- `ngx-echarts` — rejected: extra dependency and its own options/merge API to learn, for no
  capability this app needs beyond what a direct wrapper gives; also lags major ECharts releases.
- Chart.js kept for some charts, ECharts for others — rejected outright by FR-003/constitution
  Stack Decision (no mixed charting libraries permitted).

## 2. ECharts chart type for the holdings distribution chart

**Decision**: ECharts `pie` series with `radius: ['closer-to-40%', '70%']` (i.e. a doughnut,
matching the current PrimeNG `type="doughnut"` look), one data point per `assetType` group, same
grouping/exclusion logic already in `HoldingsDistributionComponent.recompute()`.

**Rationale**: ECharts has no separate "doughnut" chart type — a doughnut is a `pie` series with an
inner radius, which is the standard way to reproduce Chart.js's doughnut visually. This preserves
FR-002 parity (same categories/values/interactivity) without inventing new data shape.

**Alternatives considered**: A full donut-vs-pie decision was not open — the spec's Independent
Test and FR-002 require preserving the current doughnut look, not switching chart type.

## 3. Theming — mapping app design tokens to an ECharts theme

**Decision**: Build a small `resolveChartPalette(theme: Theme)` function (co-located with
`EchartComponent`) that returns a fixed set of series colors plus text/background colors for
tooltip/legend/axis, sourced from the same semantic intent as the app's PrimeNG preset (teal
primary, per `app.config.ts`'s `VaultfolioPreset`) — not by reading `--p-*` CSS custom properties
at runtime. `EchartComponent` re-applies the resolved palette via `setOption` whenever
`ThemeService.theme()` changes.

**Rationale**: PrimeNG's `--p-*` custom properties are designed for PrimeNG's own components and
aren't guaranteed stable keys to read generically from JS for a third-party charting library;
resolving a small first-class light/dark palette object next to the wrapper is simpler, testable,
and keeps the charting library decoupled from PrimeNG internals (Principle V simplicity, and
Product Scope's general preference for isolating swappable concerns). The existing hardcoded
`SLICE_COLORS` array in `HoldingsDistributionComponent` is replaced by this shared, theme-aware
palette rather than kept as a local constant, so future charts reuse the same colors (FR-009).

**Alternatives considered**: Reading computed `--p-*` CSS variables via `getComputedStyle` at
render time — rejected: couples the chart wrapper to PrimeNG's internal token names, which the
constitution does not guarantee stable, and complicates SSR/test-environment rendering (no DOM
computed styles in some unit-test setups).

## 4. Where the wrapper component lives

**Decision**: `apps/frontend/src/app/shared/chart/echart.component.ts`, following the exact
co-location and JSDoc-with-spec-references convention already established by
`apps/frontend/src/app/shared/icon/icon.component.ts`.

**Rationale**: Confirmed via codebase survey: every `libs/*` project (`api-contract`, `domain/*`,
`market-data`, `notifications`) is a plain TypeScript library tagged `scope:backend`/
`scope:domain`/`scope:shared`, with zero Angular dependencies, and the Nx module-boundary ESLint
rule only allows `scope:frontend` to depend on `scope:shared` — there is no `scope:frontend`
reusable library convention in this repo. `apps/frontend/src/app/shared/` is where reusable Angular
UI already lives (`IconComponent`). Introducing a new Nx library for one component would be new,
unprecedented structure not warranted by the current library-splitting rationale (libs exist to
share code between the NestJS backend and DTO contracts, not to modularize Angular UI).

**Alternatives considered**: A new `libs/frontend-ui` (or similar) Nx library — rejected as
premature structure for a single wrapper component; would need its own `scope:frontend` tag and
boundary-rule change unsupported by any existing precedent, contradicting Principle V's "start
simple" guidance.

## 5. Theme/language reactivity

**Decision**: `EchartComponent` uses Angular `effect()` over `ThemeService.theme()` and (for any
future chart needing localized series labels, not this migration's doughnut, which is fed
already-translated `ASSET_TYPE_LABELS`) accepts already-localized data from its caller rather than
doing its own i18n lookups — so it stays a display-only, framework-agnostic-configuration
component. Tooltip/legend chrome text (if ECharts renders any static chrome text itself, e.g. no
built-in strings by default) needs no separate localization; all visible labels come from the
`option` object the caller supplies, which the caller is responsible for localizing via the
existing `TranslatePipe`/`I18nService`.

**Rationale**: `HoldingsDistributionComponent` already resolves labels via `ASSET_TYPE_LABELS`
(static, not yet run through `I18nService` — a pre-existing gap noted in the codebase survey,
called out for the migration to fix per FR-008: "chart labels ... MUST respect the ... active
language"). Fixing this means `HoldingsDistributionComponent` — not `EchartComponent` — reruns its
`recompute()`/option-building whenever `I18nService.language()` changes, since it owns label
sourcing; `EchartComponent` only needs to re-render when the _option object it's given_ changes,
plus independently re-theme on `ThemeService.theme()` changes (color re-application shouldn't
require the caller to rebuild its whole option).

**Alternatives considered**: Push i18n lookups into `EchartComponent` itself — rejected: would
couple a generic reusable wrapper (FR-009) to this app's specific i18n key structure, when only
this one caller currently has localized labels to show.

## 6. Empty and loading states

**Decision**: Keep empty-state handling in `HoldingsDistributionComponent` (already implemented via
`hasData()`), but route its message through `TranslatePipe`/`I18nService` instead of the current
hardcoded English string (fixing the gap the codebase survey flagged, in scope per FR-006/FR-008).
`EchartComponent` itself exposes a `loading` input (boolean) that, when true, calls ECharts'
built-in `showLoading()`/`hideLoading()` API instead of rendering `setOption`, satisfying FR-007
for any future chart with an async data source; the current holdings-distribution data is
synchronous (derived from an `@Input()` already fetched by the parent), so it sets `loading=false`
always, but the input exists so the pattern doesn't need revisiting for the next chart that has a
real loading phase.

**Rationale**: Reuses ECharts' native loading overlay (themable, no extra markup) rather than
building a bespoke skeleton, keeping the wrapper thin. Localizing the existing empty-state string
closes a gap the spec's FR-008 explicitly requires going forward.

**Alternatives considered**: A custom CSS skeleton loader — rejected as unnecessary given ECharts
ships an equivalent built-in (`showLoading`), simpler to theme consistently (Principle V).

## 7. Removal of PrimeNG Chart / Chart.js

**Decision**: After `HoldingsDistributionComponent` is migrated, remove `ChartModule` import from
that component, and remove the `chart.js` entry from root `package.json` (it is currently pulled
in transitively as PrimeNG's chart dependency, not used anywhere else per the codebase survey's
grep). Verify via a repo-wide search for `primeng/chart` and `chart.js` post-migration (FR-003,
SC-001).

**Rationale**: Direct requirement of FR-003 and the constitution's Stack Decision amendment;
confirmed via codebase survey that no other component imports `ChartModule` or `chart.js`, so
removal is safe once this one component is migrated.

**Alternatives considered**: None — full removal is mandated, not a design choice.
