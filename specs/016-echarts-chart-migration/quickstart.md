# Quickstart: Validating the ECharts Chart Migration

## Prerequisites

- Node.js LTS + npm installed (per `[Vaultfolio uses npm](../../CLAUDE.md)`-style workspace
  convention — this repo uses npm, not pnpm, for Nx commands).
- `echarts` added as a dependency in `apps/frontend/package.json` and installed (`npm install` at
  repo root).
- At least one seeded/test account with holdings that have known values across more than one
  `assetType` (e.g. one Share, one ETF, one Gold holding), to exercise multiple pie/doughnut
  segments — and a second account/state with zero valuable holdings, to exercise the empty state.

## Run the frontend

```bash
npm exec nx serve frontend
```

Sign in and open the dashboard.

## Validation scenarios (map to spec Acceptance Scenarios)

1. **Chart renders via ECharts (US1 AS1)**
   - Open the dashboard with a holdings-bearing account.
   - Expect: a doughnut chart in the "Allocation" card, segments matching each `assetType` present.
   - Verify no `p-chart`/Chart.js element in the DOM (inspect element — should be an ECharts
     `<canvas>` inside `app-echart`, not a `<p-chart>` component).

2. **Tooltip/legend interaction (US1 AS2)**
   - Hover (desktop) or tap (mobile emulation) a chart segment.
   - Expect: a tooltip showing the asset-type label and its value/percentage; legend entries are
     visible and match the segments.

3. **Theme adaptation (US1 AS3)**
   - Toggle the app's light/dark theme switch (header) while the chart is visible.
   - Expect: chart colors (series colors, tooltip background, legend/label text) flip immediately
     to the corresponding palette, without a page reload, and remain legible in both themes.

4. **Responsive resize (US1 AS4)**
   - Resize the browser window narrower (or use device emulation) while the chart is visible.
   - Expect: the chart canvas resizes to fit its card with no clipping, overflow, or distorted
     aspect ratio.

5. **Data parity (US2 AS1)**
   - Using a fixed, known holdings data set, compare segment count/labels/values against the same
     data set rendered by the previous PrimeNG/Chart.js version (e.g. via a screenshot taken
     before this migration, or by temporarily checking out the prior commit).
   - Expect: identical categories and equivalent values (percentages may render with equal or
     better precision, per FR-002's "equivalent or richer").

6. **Empty state (US2 AS2)**
   - Open the dashboard on an account with holdings but no computable values (or zero holdings).
   - Expect: the localized empty-state message renders (not a blank/broken chart area), and its
     text changes when the app language is switched (validates FR-008's localization requirement
     was applied to this previously-hardcoded string too).

7. **No PrimeNG chart / Chart.js remnants (US3 AS1)**

   ```bash
   grep -rn "primeng/chart" apps/ libs/
   grep -rn "chart.js" package.json apps/frontend/package.json
   ```

   Expect: no matches (aside from this quickstart/spec/plan documentation itself).

8. **Reusable pattern documented (US3 AS2)**
   - Confirm [contracts/echart-component-api.md](./contracts/echart-component-api.md) exists and
     `apps/frontend/src/app/shared/chart/echart.component.ts` implements it.

## Automated checks

```bash
npm exec nx test frontend      # unit tests, incl. new EchartComponent + updated
                                # HoldingsDistributionComponent specs
npm exec nx lint frontend
npm exec nx build frontend     # confirms chart.js/primeng-chart removal doesn't break the build
```
