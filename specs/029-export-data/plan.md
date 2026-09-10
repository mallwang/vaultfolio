# Implementation Plan: Data Export (Per-Feature and Full Account)

**Branch**: `029-export-data` | **Date**: 2026-09-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/029-export-data/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add a reusable export capability — JSON, CSV, Excel (.xlsx), and a chart-and-infobox PDF —
generated **entirely client-side** in the browser from data the frontend already fetches through
the existing per-feature APIs, driven by a small per-feature registry and one generic Angular
split-button control that every data-holding feature mounts next to its own "Add" action.
Generating in the browser (rather than adding a new backend export module) is what lets the
export reuse the app's _existing_ translation mechanism (FR-006 requires "the same
language/translation mechanism already used elsewhere in Vaultfolio", which today is
frontend-only) without duplicating a translation dictionary into the backend, and lets PDF charts
reuse the _exact_ ECharts option objects the page already computes, rendered once more into an
off-screen canvas for image capture — no server-side chart renderer or new backend dependency
needed. Holdings and Account Overview (the only two domains with real data today) register real
data providers; the four still-placeholder domains (Retirement, Insurances, Haushaltsplaner,
Historic Wealth Development) register empty providers now — which already satisfies FR-014's
"valid but empty" requirement — and switch to real data automatically once each is actually built,
with no change to the shared export/generation code (FR-008/FR-012). Account Settings' existing
"Export my data" no-op button is wired to fetch every registered feature's full data via its
existing API, build each feature's files with the same shared generator, and zip them client-side
into one archive.

## Technical Context

**Language/Version**: TypeScript throughout; Angular (frontend) generates the exports, using data
already served by the existing NestJS backend APIs — no new backend module for this feature.

**Primary Dependencies**: NestJS, Angular, Nx (baseline, per the constitution's Stack Decision).
New for this feature (frontend only — see `research.md` for the evaluation and rejected
alternatives, including a backend-generation approach):

- `exceljs` (browser build) — Excel (`.xlsx`) generation with per-column types/formatting
  (FR-003a).
- `pdfmake` (browser build) — PDF generation (table + embedded PNG chart images), the same
  well-established pure-JS PDF library considered for a backend approach, used here client-side
  instead.
- `echarts` (already a dependency, used headless): an off-screen, unattached canvas instance,
  fed the same `EChartsOption` the visible chart component already computes, captured via
  `chart.getDataURL()` — no new charting dependency.
- `jszip` — client-side ZIP assembly for the full "Export my data" archive (FR-010/FR-011).

No new CSV library is needed — CSV is simple enough (with RFC 4180 quoting for the edge case in
spec's Edge Cases) to implement directly in the shared export library, avoiding an extra
dependency per Principle V's YAGNI guidance.

**Storage**: SQLite (existing), accessed via the backend only (Principle II) through the _existing_
per-feature list endpoints. This feature adds no new persisted tables, no new backend endpoints,
and no new database migration — exports are generated on demand in the browser from data already
fetched through the current API and are never stored server-side (see spec Assumptions).

**Testing**: Jest (Nx default) with `jsdom`, for the new shared export library and its per-feature
adapters; contract/integration tests per Principle IV that parse the real generated CSV/XLSX/PDF/
ZIP bytes (not just the in-memory row objects that produced them) using the same libraries'
readers (e.g. `exceljs` read-back, a PDF text/structure check, `jszip` read-back). Chart-image
capture is isolated behind a small seam so it can be mocked in unit tests without needing a real
canvas in the Jest/jsdom environment.

**Target Platform**: Modern evergreen browsers (Angular frontend) — no server-side platform
impact from this feature.

**Project Type**: web-service + frontend, Nx monorepo (see Project Structure below).

**Performance Goals**: Single-feature export (JSON/CSV/XLSX/PDF) completes in under 5s for up to a
few hundred records (SC-001); the full "Export my data" ZIP completes in under 30s for an account
of typical size (SC-005) — both client-side budgets (fetch existing data + in-browser generation).

**Constraints**: Every export MUST be scoped to the requesting user's own data only (FR-013) —
satisfied by construction, since the frontend only ever fetches data through the existing
authenticated per-user API, the same way the on-screen pages already do; no new server-side access
path is introduced. No new backend dependency, schema, or migration. Large PDFs must not block the
UI thread long enough to feel broken — generation runs via the existing async/Promise-based flow
(`pdfmake`/`exceljs`/`jszip` are all async), not a synchronous blocking call.

**Scale/Scope**: 6 features (2 with real data today: Holdings, Account Overview; 4 frontend-only
placeholders today), 4 formats (JSON/CSV/XLSX/PDF) per feature, 1 aggregated "Export my data" flow.
1 new Nx library (`libs/export`, see Project Structure) and 1 new component added to the existing
`libs/frontend/shared-ui`, plus a small per-feature registration (data provider + column/label
definitions + infobox text) added to each of the 6 existing domain libraries and to the
Settings/profile area — no backend changes.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First** — PASS. The reusable JSON/CSV/XLSX/PDF/ZIP generation logic lives in a new
  standalone `libs/export` (frontend-agnostic where possible) library with a well-defined
  contract (`FeatureExportDefinition` in → files out), independently unit-testable without Angular
  routing/DI. The Angular-specific split-button control is a separate, thin `libs/frontend/shared-ui`
  addition that only wires the control's UI to that library — it holds no generation logic itself.
- **II. API-First Interface** — PASS, satisfied by construction rather than by adding an API: the
  frontend only ever reads data via the _existing_ documented per-feature endpoints (Holdings,
  Account Overview) — no new endpoint, no direct DB access, no bypass. No new API surface is added
  by this feature, so there is nothing new to version or contract-test on the backend; the shared
  export library's own input/output contract (Phase 1's `contracts/`) is the new contract that
  _does_ need documenting.
- **III. Test Coverage** — PASS with an explicit commitment: exported monetary/quantity values
  (e.g. holding purchase price, quantity, account balances) MUST be asserted with exact expected
  values in the new library's tests, not approximate — the export path re-serializes existing
  `decimal.js`-backed values and must not introduce float rounding when writing CSV text / XLSX
  cells / PDF table cells.
- **IV. Integration Testing** — PASS with an explicit commitment: integration tests exercise the
  _real_ serialized formats — a generated CSV parsed back, a generated `.xlsx` read back via
  `exceljs`, a generated PDF checked for its table/text content, and the full-export ZIP read back
  via `jszip` — for both a populated feature and an empty one (FR-014), not just in-memory
  `FeatureExportDefinition` objects.
- **V. Observability, Versioning & Simplicity** — PASS. No new abstractions beyond what FR-008/
  FR-012 explicitly require (one generic library + one registry, not a plugin system); CSV is
  hand-rolled rather than adding a dependency for it (YAGNI); the export library's
  `FeatureExportDefinition` contract is documented and versioned like any other contract per this
  principle, so an incompatible future change to it is a deliberate, tracked decision. Export
  actions are user-initiated, client-side, and produce no server-side state to log — no new
  logging surface is needed beyond what already covers the read APIs the export reuses.
- **Product Scope / domain boundaries (Stack Decision)** — PASS. The shared export control and
  library live in `scope:shared`-tagged libraries, never in a `scope:frontend-domain` library, so
  no domain imports another domain to get export behavior (Nx module-boundary rule preserved) —
  each domain only _registers_ its own `FeatureExportDefinition` with the shared capability.

No violations requiring justification — Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/029-export-data/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
├── design.md            # Already present — approved mockup (see spec.md)
├── mockup.html           # Already present — approved mockup
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
└── frontend/                            # Angular — no apps/backend changes for this feature
    └── src/app/settings/profile/        # wires "Export my data" to the new full-export flow

libs/
├── export/                              # NEW — scope:shared. Framework-agnostic generation:
│   └── src/lib/
│       ├── json-exporter.ts             #   FeatureExportDefinition -> JSON bytes
│       ├── csv-exporter.ts              #   FeatureExportDefinition -> CSV bytes (RFC 4180)
│       ├── xlsx-exporter.ts             #   FeatureExportDefinition -> .xlsx bytes (exceljs)
│       ├── pdf-exporter.ts              #   FeatureExportDefinition (+ chart images) -> PDF bytes
│       ├── full-export-archive.ts       #   many FeatureExportDefinitions -> ZIP bytes (jszip)
│       ├── feature-export-registry.ts   #   registry each domain lib registers against (FR-008/012)
│       └── feature-export-definition.ts #   the shared contract type (see data-model.md)
│
├── frontend/
│   ├── shared-ui/                       # EXTENDED — scope:shared
│   │   └── src/lib/export-control/      #   NEW: split-button + format menu Angular component,
│   │                                    #   wraps libs/export for the Angular DI/HttpClient/
│   │                                    #   TranslateService seams (chart image capture, download)
│   │
│   └── domain/                          # EXTENDED — scope:frontend-domain (each domain unchanged
│       ├── holdings/                    #   in shape; each adds one small registration file
│       ├── account-overview/            #   supplying its FeatureExportDefinition — data provider
│       ├── retirement/                  #   (empty for the 4 placeholders today), column/label
│       ├── insurances/                  #   defs, and infobox text sourced from docs/user-guide.md
│       ├── haushaltsplaner/             #   where a section already exists (Holdings §4,
│       └── historic-wealth-development/ #   Account Overview §5)
```

**Structure Decision**: One new Nx library, `libs/export` (tag `scope:shared`, alongside
`libs/api-contract`), holds every format's generation logic plus the full-export archive
assembly and the `FeatureExportDefinition` contract/registry — framework-independent per
Principle I, so it is unit-testable in plain Jest without Angular or a browser DOM wired up
(chart-image capture is the one seam that needs a real/mocked canvas, isolated behind an
injectable function). `libs/frontend/shared-ui` gains one new component, the export split-button
control, which is the only piece allowed to depend on Angular services (HttpClient to fetch each
feature's data, `TranslateService` for labels, and the off-screen ECharts capture) — consistent
with the existing rule that `scope:frontend-domain` libraries may depend only on `scope:shared`.
Each of the 6 existing domain libraries gets a small, additive registration (its
`FeatureExportDefinition`) rather than any change to `libs/export` itself, which is what makes
FR-008/FR-009/FR-012 ("no changes to the generation logic when a feature adopts or is added")
concretely true rather than aspirational. No `apps/backend` changes and no new Nx app.

## Post-Phase-1 Constitution Re-Check

Re-evaluated after `research.md`/`data-model.md`/`contracts/`/`quickstart.md` were written: no new
violations surfaced by the detailed design. The one design refinement worth noting — chart-image
capture and translation-key resolution both stay in `libs/frontend/shared-ui`'s export control
rather than `libs/export` (contracts/export-lib.md's "Language resolution" section) — reinforces
rather than weakens Principle I's framework-independence goal for `libs/export`. All gates remain
PASS.

## Complexity Tracking

_No Constitution Check violations — this section is not needed._
