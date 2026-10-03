# Implementation Plan: Earnings Export Rework

**Branch**: `035-earnings-export-rework` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/035-earnings-export-rework/spec.md`

## Summary

Phase 1 replaces the earnings PDF (today: the generic export table, one row per payslip part, cut off after "Bonus") with a purpose-built, multi-section landscape document: "Gross per year" chart → per-employer overview (employers as columns, last column "Career total") → "Monthly overview" (year × month grid, gross) → "All taxes and contributions per year". Years/employers are ordered newest first. The data is derived from the **existing** `GET /earnings/overview` (`career`, `yearly`) and `GET /earnings/tables` (`monthGrid`, `taxesPerYear`) responses, so PDF totals match the screen by construction (FR-010) and no backend change is needed.

Technically: the shared export capability (029) gets an **optional, backward-compatible** "PDF sections" extension (`pdfSections` on `ResolvedFeatureExport`, an optional `getPdfSections()` / `pdfInfoboxKey` on `FeatureExportDefinition`). When a definition supplies sections, the PDF exporter renders them (table sections with fit-to-page column widths, repeated headers, light print style) instead of the generic single table; every other feature and every other format is untouched (FR-012, FR-014). Phase 2 (JSON/CSV/XLSX) is out of scope for this plan.

## Technical Context

**Language/Version**: TypeScript (Angular frontend, Nx monorepo); no backend change

**Primary Dependencies**: existing only — `pdfmake` (PDF), `echarts` (chart → PNG via the existing `CHART_IMAGE_CAPTURE`), `pdfjs-dist` (already a dependency, used in tests to extract text for layout assertions). No new dependency.

**Storage**: none (read-only over existing earnings API; nothing persisted)

**Testing**: Jest (`libs/export`, `libs/frontend/domain/earnings`, `libs/frontend/shared-ui`); exact-value assertions for all aggregations (Principle III); integration test producing a real PDF and extracting its text (Principle IV); `verify-ui` Playwright check of the real download in DE and EN

**Target Platform**: modern evergreen browsers (PDF generated client-side, as today)

**Project Type**: Nx monorepo, frontend-only change across `libs/export`, `libs/frontend/shared-ui`, `libs/frontend/domain/earnings`, i18n translations

**Performance Goals**: PDF for 20 years / 8 employers generated in under 3 s on a typical laptop (current export is of the same order)

**Constraints**: all tables fully within landscape A4 content width (≈ 780 pt at 30 pt margins); no clipping at the largest realistic data (20 years, 8 employers, six-figure yearly amounts, long employer names); DE/EN via UI language; PDF always light/print palette; no amounts in logs; no source file names in the PDF (FR-006/013)

**Scale/Scope**: one export, 4 content sections; ≤ ~25 tax rows per page-flow, multi-page tables with repeated header

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle / rule                       | Assessment                                                                                                                                                                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Library-First                       | PASS. Section model + rendering live in the framework-independent `libs/export`; the aggregation into sections is a pure function in the earnings domain lib, unit-testable without Angular. No new lib.                                                                   |
| II. API-First                          | PASS. Consumes only existing documented endpoints (`/earnings/overview`, `/earnings/tables`); no new endpoint, no contract change.                                                                                                                                         |
| III. Test Coverage                     | PASS (planned). Exact-value tests for career total = sum of employers, ordering, grid sums, tax rows; no tolerance assertions. Sums use integer cents like the existing `gridRows`.                                                                                        |
| IV. Integration Testing                | PASS (planned). Changed shared contract (`ResolvedFeatureExport`) covered by an exporter integration test that renders a real PDF and checks extracted text/columns; regression test that other features' PDFs and all non-PDF formats are unchanged. Synthetic data only. |
| V. Observability/Versioning/Simplicity | PASS. Additive optional fields (no breaking change to the lib contract → MINOR); no new abstraction beyond one section type union; no amounts logged.                                                                                                                      |
| Sensitive Personal Data (Earnings)     | PASS. Data minimization is tightened (no file names / corrected-figure names in the PDF); data stays owner-only, generated on device from the user's own API data; a 403/503 yields an empty-state PDF, never partial figures; no logs with amounts.                       |
| Product Scope / Stack                  | PASS. Reuses shared export capability (029) and standard charting; no new data origin.                                                                                                                                                                                     |

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
│   └── export-pdf-sections.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
libs/export/src/lib/
├── feature-export-definition.ts   # + PdfSection types, optional pdfSections / getPdfSections / pdfInfoboxKey
├── pdf-exporter.ts                # + render sections (fit-to-width tables, repeated header, light style); generic path unchanged
├── pdf-exporter.spec.ts           # + section rendering, text-extraction layout assertions, unchanged generic path
└── index.ts                       # export new types

libs/frontend/shared-ui/src/lib/export-control/
└── export-control.component.ts    # PDF: use pdfInfoboxKey, await getPdfSections(), skip generic fetchData/rows when sections supplied

libs/frontend/domain/earnings/src/lib/
├── earnings-export.definition.ts  # keep columns/fetchData for csv/xlsx/json; add pdfInfoboxKey, getChartOptions, getPdfSections
├── earnings-pdf-sections.ts       # NEW pure builders: career table, month grid, tax table (+ ordering)
├── earnings-pdf-sections.spec.ts  # NEW exact-value tests
└── earnings-export.definition.spec.ts  # extend

libs/frontend/shared-ui/src/lib/i18n/translations/
├── earnings.de.ts / earnings.en.ts  # + export.pdfInfobox, section titles, empty state, "Career total" etc. (reuse existing earnings.terms.* / earnings.tables.* keys where present)
```

**Structure Decision**: extend the existing `libs/export` PDF exporter with an optional sections model rather than creating an earnings-specific PDF renderer, so the layout engine (fit-to-width, repeated header, locale formatting) stays reusable by the future Phase 2 and other domains, while all earnings knowledge (what goes in which table) stays in the earnings domain lib. No new Nx project.

## Complexity Tracking

_No constitution violations._
