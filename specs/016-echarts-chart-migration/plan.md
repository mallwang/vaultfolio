# Implementation Plan: ECharts Chart Migration

**Branch**: `016-echarts-chart-migration` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-echarts-chart-migration/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Replace the app's only chart today — the PrimeNG `p-chart` (Chart.js-backed) doughnut in
`HoldingsDistributionComponent` — with an Apache ECharts equivalent, and establish a reusable,
themed, localized ECharts wrapper component (`apps/frontend/src/app/shared/chart/`) so this is a
one-time migration, not a per-chart reinvention. The wrapper reads `ThemeService.theme()` and
`I18nService.language()` to re-render on theme/language change, exposes loading/empty states, and
is responsive via a `ResizeObserver`. `chart.js` and `primeng/chart` are removed from the
dependency tree once the doughnut chart is migrated (constitution Stack Decision, already amended
to mandate ECharts).

## Technical Context

**Language/Version**: TypeScript ~6.0.3, Angular ~22.1.0 (frontend), Node.js LTS (backend,
unaffected by this feature)

**Primary Dependencies**: Angular (standalone components, zone-based change detection — no
zoneless config present), PrimeNG ^22.1.0 (`p-card` layout only, `ChartModule` removed), Nx
monorepo tooling. **New**: `echarts` (npm package, used directly — not `ngx-echarts`) as the sole
charting library per the constitution's Stack Decision. Must be declared as a dependency in both
root `package.json` (npm workspace) and `apps/frontend/package.json` (so `@nx/js:prune-lockfile`
includes it in the production Docker image — a root-only dependency is silently dropped there).
`ngx-echarts` is deliberately not added:
the app needs one thin, theme/i18n-aware wrapper component around ECharts' imperative
`init/setOption/dispose` API, which is simpler to own directly (Principle V, YAGNI) than to pull in
and configure an extra Angular integration library for.

**Storage**: N/A for this feature (presentation-layer only; consumes the existing
`GET /holdings` response already fetched by `DashboardComponent`)

**Testing**: Jest + Angular Testing Library conventions already used in `apps/frontend` (see
`icon.component.spec.ts`, `holdings-distribution.component.spec.ts` if present) — unit tests for
the new chart wrapper (data/option mapping, empty/loading state, theme/language re-render) and for
`HoldingsDistributionComponent`'s updated ECharts-based option-building logic.

**Target Platform**: Modern evergreen browsers (Angular frontend); no backend/server change

**Project Type**: web-service + frontend, Nx monorepo — this feature touches `apps/frontend` only

**Performance Goals**: No specific new target beyond parity; chart init/update must not
noticeably block the dashboard's initial render (ECharts instances created lazily after view init,
disposed on component destroy to avoid leaks)

**Constraints**: No new backend endpoints or data; must not increase the frontend bundle by more
than the ECharts package itself (no PrimeNG Chart + Chart.js _and_ ECharts shipped simultaneously
— FR-003 requires full removal, not addition)

**Scale/Scope**: One existing chart migrated (`HoldingsDistributionComponent`'s doughnut) plus one
new shared wrapper component; no other charts exist in the app today (spec Assumptions)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Library-First)**: Not applicable to a presentational chart wrapper — this is UI
  glue, not domain/finance logic. The value computation this chart displays already lives in
  `HoldingsDistributionComponent` and is untouched by this migration. **PASS**.
- **Principle II (API-First Interface)**: No new/changed API surface; the migration consumes the
  same `GET /holdings` response already fetched by `DashboardComponent`. **PASS**.
- **Principle III (Test Coverage)**: This feature touches presentation, not money storage/
  calculation — the existing Decimal-based value computation is unchanged and already covered.
  Exact-value assertion rules don't newly apply here, but the chart wrapper's data-mapping (values
  → ECharts series) still gets standard unit tests. **PASS**.
- **Principle IV (Integration Testing)**: No new service/module boundary or shared schema is
  introduced; this is a single frontend component swap. Component-level tests (data mapping,
  empty/loading, theme/language reactivity) are the appropriate level, not a new integration test
  tier. **PASS**.
- **Principle V (Observability, Versioning & Simplicity)**: Adopting `echarts` directly (no
  `ngx-echarts`) is the simpler of the two options — one wrapper component, no extra Angular
  integration dependency to configure/version. No new abstraction beyond the one reusable wrapper
  FR-009 explicitly requires. **PASS**.
- **Stack Decision (Charting library)**: This feature _is_ the migration the constitution's
  Stack Decision amendment (v3.2.0) exists for — ECharts becomes the sole charting library;
  PrimeNG's `ChartModule`/Chart.js are removed. **PASS** (implements the constraint).

No violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/016-echarts-chart-migration/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
└── frontend/                                    # Angular — only project touched by this feature
    ├── package.json          # add "echarts" to dependencies — required here (not just root)
    │                          # so @nx/js:prune-lockfile includes it in the production image
    └── src/app/
        ├── shared/
        │   └── chart/                             # NEW — reusable ECharts wrapper (mirrors
        │       ├── echart.component.ts            # shared/icon/ conventions: standalone,
        │       ├── echart.component.html           # co-located template/styles/spec, JSDoc
        │       ├── echart.component.css             # linking back to research.md/data-model.md)
        │       └── echart.component.spec.ts
        └── holdings/
            └── holdings-distribution/
                ├── holdings-distribution.component.ts    # MODIFIED — build ECharts `option`
                ├── holdings-distribution.component.html  # instead of Chart.js data/options;
                └── holdings-distribution.component.spec.ts  # replace `<p-chart>` with `<app-echart>`

# libs/* (api-contract, domain/*, market-data, notifications) are backend/shared TS-only,
# tagged scope:backend|domain|shared — none are touched by this frontend-only feature, and no
# new lib is introduced (a chart wrapper is Angular UI, which this repo keeps in
# apps/frontend/src/app/shared/, not in libs/ — see research.md #4).
```

**Structure Decision**: Everything lives inside the existing `apps/frontend` Nx project. One new
component, `EchartComponent` (selector `app-echart`), is added under
`apps/frontend/src/app/shared/chart/`, following the exact co-location/JSDoc pattern already used
by `apps/frontend/src/app/shared/icon/`. It is the FR-009 "reusable, documented pattern" for future
charts. `HoldingsDistributionComponent` is modified in place to build an ECharts `option` object
(pie/doughnut series) instead of a Chart.js dataset, and its template swaps `<p-chart>` for
`<app-echart>`. No new Nx library is introduced — this repo's `libs/*` exist to share
backend/domain/contract code, not to modularize Angular UI (confirmed: no `scope:frontend`-tagged
lib exists, and the Nx module-boundary ESLint rule doesn't define one), so a second Angular UI
component follows the established `apps/frontend/src/app/shared/` convention instead.

## Post-Design Constitution Re-Check

_Re-evaluated after Phase 1 (data-model.md, contracts/echart-component-api.md, quickstart.md)._

No new violations introduced by the design. The decision to hand-roll `EchartComponent` instead
of adopting `ngx-echarts` (research.md #1) and to keep it out of a new Nx library (research.md #4)
are both further applications of Principle V (simplicity/YAGNI), not exceptions to it. All gates
from the pre-design Constitution Check above still **PASS**.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally left empty.
