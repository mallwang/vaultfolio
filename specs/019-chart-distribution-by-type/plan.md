# Implementation Plan: Distribution Chart Grouped by Asset Type

**Branch**: `019-chart-distribution-by-type` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-chart-distribution-by-type/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Change the existing holdings-distribution-by-value pie chart to group every holding by its
`AssetType` only (never by the holding's own `name`), so it always shows at most one slice per
type (ETF, Share, Precious metal, Crypto, Deposit money) labeled with the type's existing
localized `assetType.*` translation, with each slice's value the sum of that type's holdings'
already-computed values. This is a pure frontend, single-component change: the aggregation
already runs client-side in `HoldingsDistributionComponent.recompute()`, so the fix is to drop the
per-name grouping branch (currently used for Precious metal/Crypto/Deposit money) and always key
by `assetType`, simplifying the entry shape accordingly. No backend, API, or domain-library change
is needed.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS runtime for the backend; unaffected by this feature)

**Primary Dependencies**: Angular (frontend), Apache ECharts (charting, per constitution Stack
Decision) — both already in place; no new dependency introduced.

**Storage**: N/A for this feature — no persisted data model changes; the chart consumes the
already-fetched `GET /holdings` response client-side (unchanged endpoint/contract).

**Testing**: Jest via Nx (Vitest-style `vi.mock`/`describe` as already used in
`holdings-distribution.component.spec.ts`); existing unit tests for this component are updated/
extended to assert per-type grouping.

**Target Platform**: Modern evergreen browsers (Angular frontend); no backend/deployment impact.

**Project Type**: web-service + frontend, Nx monorepo — this feature touches only the `frontend`
Nx project.

**Performance Goals**: N/A — grouping runs over an already-fetched, small (per-user) holdings list
client-side; no new performance-sensitive path introduced.

**Constraints**: Must not change the `GET /holdings` API contract, per-holding value computation
(FR-003), or excluded-holdings behavior (FR-004) — only the grouping key and slice label logic in
`HoldingsDistributionComponent`.

**Scale/Scope**: Single Angular component (`apps/frontend/src/app/holdings/holdings-distribution/`)
and its spec file; at most 5 slices per chart (one per `AssetType`).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: No new domain/finance logic is introduced — grouping-by-type is
  presentation aggregation over values already computed by the existing per-holding value logic
  (`HoldingsDistributionComponent.computeValue`, unchanged). This mirrors the existing precedent
  (the component already aggregates client-side today) and stays a component-local concern, not a
  library boundary. **PASS**.
- **II. API-First Interface**: No API contract change — the component continues to consume the
  existing `GET /holdings` response and reshapes it entirely client-side. **PASS**.
- **III. Test Coverage**: The change touches values (summed monetary totals per type); existing
  and updated component tests MUST assert exact expected sums per type (Decimal-based, as today),
  not approximate values. **PASS (planned)**.
- **IV. Integration Testing**: No new service/module boundary or shared schema is introduced —
  this is an intra-component presentation change, so no new integration test is required beyond
  the existing component-level tests. **PASS**.
- **V. Observability, Versioning & Simplicity**: Change is a simplification (removes the
  per-name/per-type branching, always groups by type) — no new abstraction, service, or dependency
  added. **PASS**.

No violations — Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/019-chart-distribution-by-type/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature exposes no new/changed external interface (no API,
CLI, or file-format contract) — see Phase 1 §2 rationale in research.md.

### Source Code (repository root)

```text
apps/
└── frontend/                                    # Angular
    └── src/app/holdings/holdings-distribution/
        ├── holdings-distribution.component.ts        # aggregation + chart option (this feature's change)
        ├── holdings-distribution.component.html       # unchanged (center-label overlay, excluded-count note)
        ├── holdings-distribution.component.css        # unchanged
        └── holdings-distribution.component.spec.ts    # updated/extended unit tests
```

**Structure Decision**: This feature extends only the existing `frontend` Nx app, specifically the
existing `HoldingsDistributionComponent` under `apps/frontend/src/app/holdings/holdings-distribution/`.
No existing lib is modified and no new Nx app or lib is introduced — the change is fully contained
within this presentation component, consistent with Constitution Check above.

## Complexity Tracking

> Not applicable — no Constitution Check violations.
