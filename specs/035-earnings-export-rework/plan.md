# Implementation Plan: Earnings Export Rework

**Branch**: `035-earnings-export-rework` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/035-earnings-export-rework/spec.md`

## Summary

Phase 1 replaces the earnings PDF (today: the generic export table, one row per payslip part, cut off after "Bonus") with a purpose-built, multi-section landscape document: "Gross per year" chart → per-employer overview (one row per employer, last row "Career total") → "Monthly overview" (year × month grid, gross) → "All taxes and contributions per year". Years/employers are ordered newest first. The data is derived from the **existing** `GET /earnings/overview` (`career`, `yearly`) and `GET /earnings/tables` (`monthGrid`, `taxesPerYear`) responses, so PDF totals match the screen by construction (FR-010) and no backend change is needed.

Technically: the shared export capability (029) gets an **optional, backward-compatible** "PDF sections" extension (`pdfSections` on `ResolvedFeatureExport`, an optional `getPdfSections()` / `pdfInfoboxKey` on `FeatureExportDefinition`). When a definition supplies sections, the PDF exporter renders them (table sections with fit-to-page column widths, repeated headers, light print style) instead of the generic single table; every other feature is untouched (FR-012, FR-025).

**Phase 2 (amended 2026-10-03)** gives CSV, Excel and JSON the same four tables as the PDF (FR-016 to FR-025). A second optional, backward-compatible extension of the export capability introduces a **format-neutral table model** (`ExportTable`: stable id, stable column keys, translated labels, typed columns, optional total row) via `getExportTables()` / `ResolvedFeatureExport.tables`. The earnings domain computes its report data **once** (`buildEarningsReport`) and projects it twice — into `PdfSection[]` (Phase 1, unchanged output) and into `ExportTable[]` (Phase 2) — so PDF and the other formats cannot diverge (FR-017). Exporters render the tables natively: Excel = one sheet per table, CSV = ZIP with one CSV per table, JSON = one object with a named section per table. The "Export my data" archive uses the same tables (CSV files flat in `earnings/`, FR-023).

## Technical Context

**Language/Version**: TypeScript (Angular frontend, Nx monorepo); no backend change

**Primary Dependencies**: existing only — `pdfmake` (PDF), `echarts` (chart → PNG via the existing `CHART_IMAGE_CAPTURE`), `pdfjs-dist` (tests: PDF text extraction), `exceljs` (XLSX, lazy-loaded) and `jszip` (ZIP, lazy-loaded; already used by the archive). No new dependency.

**Storage**: none (read-only over existing earnings API; nothing persisted)

**Testing**: Jest (`libs/export`, `libs/frontend/domain/earnings`, `libs/frontend/shared-ui`); exact-value assertions for all aggregations (Principle III); integration test producing a real PDF and extracting its text (Principle IV); `verify-ui` Playwright check of the real download in DE and EN

**Target Platform**: modern evergreen browsers (PDF generated client-side, as today)

**Project Type**: Nx monorepo, frontend-only change across `libs/export`, `libs/frontend/shared-ui`, `libs/frontend/domain/earnings`, i18n translations

**Performance Goals**: PDF for 20 years / 8 employers generated in under 3 s on a typical laptop (current export is of the same order)

**Constraints**: all tables fully within landscape A4 content width (≈ 780 pt at 30 pt margins); no clipping at the largest realistic data (20 years, 8 employers, six-figure yearly amounts, long employer names); DE/EN via UI language; PDF always light/print palette; no amounts in logs; no source file names in the PDF (FR-006/013)

**Scale/Scope**: one export, 4 content sections / tables (Phase 2: the same 4 as sheets / CSV files / JSON sections); ≤ ~25 tax rows per page-flow, multi-page tables with repeated header

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle / rule                       | Assessment                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Library-First                       | PASS. Section model + rendering live in the framework-independent `libs/export`; the aggregation into sections is a pure function in the earnings domain lib, unit-testable without Angular. No new lib.                                                                                                                                                                                                                       |
| II. API-First                          | PASS. Consumes only existing documented endpoints (`/earnings/overview`, `/earnings/tables`); no new endpoint, no contract change. The JSON export becomes a documented, stable public format (`contracts/export-tables.md`).                                                                                                                                                                                                  |
| III. Test Coverage                     | PASS (planned). Exact-value tests for career total = sum of employers, ordering, grid sums, tax rows; no tolerance assertions. Sums use integer cents like the existing `gridRows`. Phase 2: decimal amounts stay canonical strings through the table model and become native numbers only in the Excel cell (never in CSV/JSON); a test asserts PDF and table projections carry identical figures.                            |
| IV. Integration Testing                | PASS (planned). Changed shared contract (`ResolvedFeatureExport`) covered by exporter integration tests that render a real PDF, a real XLSX (re-read with `exceljs`), a real ZIP of CSVs (re-read with `jszip`) and real JSON, and by regression tests that other features' output is unchanged. Synthetic data only.                                                                                                          |
| V. Observability/Versioning/Simplicity | PASS. Additive optional fields (no breaking change to the lib contract → MINOR); one section union plus one neutral table type, both optional; the earnings report is computed once and projected, no second aggregation; no amounts logged. The JSON format of the earnings export changes (breaking for consumers of the old per-payslip JSON) — acceptable, user-requested, called out in the quickstart and release notes. |
| Sensitive Personal Data (Earnings)     | PASS. Data minimization is tightened in every format (no file names / corrected-figure names / per-payslip rows in PDF, CSV, Excel, JSON or the archive); data stays owner-only, generated on device from the user's own API data; a 403 yields empty tables, a 503 fails visibly, never partial figures; no logs with amounts.                                                                                                |
| Product Scope / Stack                  | PASS. Reuses shared export capability (029) and standard charting; no new data origin.                                                                                                                                                                                                                                                                                                                                         |

No violations → Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/035-earnings-export-rework/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── export-pdf-sections.md
│   └── export-tables.md          # Phase 2: neutral table model, Excel / CSV-ZIP / JSON shapes
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
libs/export/src/lib/
├── feature-export-definition.ts   # + PdfSection types, optional pdfSections / getPdfSections / pdfInfoboxKey
│                                  #   Phase 2: + ExportTable types, optional tables / getExportTables
├── pdf-exporter.ts                # + render sections (fit-to-width tables, repeated header, light style); generic path unchanged
├── pdf-exporter.spec.ts           # + section rendering, text-extraction layout assertions, unchanged generic path
├── csv-exporter.ts                # Phase 2: tables -> ZIP of CSV files (+ shared per-table CSV builder); generic path unchanged
├── xlsx-exporter.ts               # Phase 2: tables -> one sheet per table; generic path unchanged
├── json-exporter.ts               # Phase 2: tables -> object with named sections; generic path unchanged
├── export-feature.ts              # Phase 2: + exportFileExtension(resolved, format) ('zip' for CSV with tables)
├── full-export-archive.ts         # Phase 2: resolve tables / PDF sections; CSV tables as flat files in <featureId>/
├── *.spec.ts                      # Phase 2: round-trip tests (xlsx re-read, zip re-read, json parse), unchanged-generic regression
└── index.ts                       # export new types + exportFileExtension

libs/frontend/shared-ui/src/lib/export-control/
└── export-control.component.ts    # PDF: use pdfInfoboxKey, await getPdfSections(), skip generic fetchData/rows when sections supplied
                                   # Phase 2: non-PDF: await getExportTables() (skip fetchData), download name via exportFileExtension

libs/frontend/domain/earnings/src/lib/
├── earnings-export.definition.ts  # pdfInfoboxKey, getChartOptions, getPdfSections; Phase 2: + getExportTables, per-payslip fetchData/columns/toExportRow retired
├── earnings-report.ts             # Phase 2 NEW: buildEarningsReport (single computation of all rows, ordering, sums)
├── earnings-pdf-sections.ts       # pure projection report -> PdfSection[] (Phase 1 output unchanged)
├── earnings-export-tables.ts      # Phase 2 NEW: pure projection report -> ExportTable[] (stable keys, separate gross/net columns)
├── earnings-*.spec.ts             # exact-value tests incl. PDF-vs-tables figure parity
└── earnings-export.definition.spec.ts  # extend

libs/frontend/shared-ui/src/lib/i18n/translations/
├── earnings.de.ts / earnings.en.ts  # + export.pdfInfobox, section titles, empty state, "Career total" etc. (reuse existing earnings.terms.* / earnings.tables.* keys where present)
```

**Structure Decision**: extend the existing `libs/export` PDF exporter with an optional sections model rather than creating an earnings-specific PDF renderer, so the layout engine (fit-to-width, repeated header, locale formatting) stays reusable by other domains, while all earnings knowledge (what goes in which table) stays in the earnings domain lib. Phase 2 follows the same split: format-specific serialization (sheets, CSV files, JSON object) lives in `libs/export`; what the tables contain lives in the earnings lib, derived once in `buildEarningsReport`. No new Nx project.

## Complexity Tracking

_No constitution violations._
