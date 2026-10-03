---
description: 'Task list for 035 Earnings Export Rework (Phase 1: PDF, Phase 2: CSV/Excel/JSON)'
---

# Tasks: Earnings Export Rework

**Input**: Design documents from `/specs/035-earnings-export-rework/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/export-pdf-sections.md, contracts/export-tables.md, quickstart.md

**Tests**: Included. The plan and constitution (Principles III/IV) require exact-value unit tests and an exporter integration test; no tolerance assertions, synthetic data only.

**Scope**: Phase 1 (PDF, T001–T033) is delivered. Phase 2 (User Story 4: CSV, Excel, JSON and the "Export my data" archive, spec amended 2026-10-03) is tasked in phases 8–10 below (T034–T062). T022/T023 guarded that non-PDF output stayed unchanged during Phase 1 (FR-014); Phase 2 deliberately replaces the earnings-specific part of T023 (T055).

**No backend change**: no controller/DTO/route is touched, so no OpenAPI task applies.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (income-story PDF), US2 (nothing cut off), US3 (language), US4 (CSV/Excel/JSON/archive, Phase 2)

## Path Conventions

- `libs/export/src/lib/` — framework-independent export lib
- `libs/frontend/shared-ui/src/lib/export-control/` — export UI control
- `libs/frontend/domain/earnings/src/lib/` — earnings domain lib
- `libs/frontend/shared-ui/src/lib/i18n/translations/` — `earnings.de.ts` / `earnings.en.ts`

---

## Phase 1: Setup

**Purpose**: Establish baseline before changing shared code

- [x] T001 Run `npm exec nx test export`, `npm exec nx test frontend-shared-ui` and `npm exec nx test frontend-domain-earnings` and confirm they are green; note the baseline so regressions in other features' PDFs are attributable
- [x] T002 [P] Read `libs/export/src/lib/pdf-exporter.ts`, `libs/export/src/lib/feature-export-definition.ts`, `libs/frontend/shared-ui/src/lib/export-control/export-control.component.ts` and `libs/frontend/domain/earnings/src/lib/earnings-export.definition.ts` to learn the current generic PDF path, chart capture flow and earnings definition before editing (no file changes)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared, backward-compatible "PDF sections" model and renderer that all stories build on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add the types `PdfColumnFormat`, `PdfTableColumn`, `PdfTableRow`, `PdfSection` and the optional `pdfSections?` on `ResolvedFeatureExport`, plus optional `getPdfSections?()` and `pdfInfoboxKey?` on `FeatureExportDefinition`, exactly as in `specs/035-earnings-export-rework/contracts/export-pdf-sections.md`, in `libs/export/src/lib/feature-export-definition.ts`
- [x] T004 Export the new types from the lib barrel `libs/export/src/index.ts`
- [x] T005 Extend `ExportControlComponent` in `libs/frontend/shared-ui/src/lib/export-control/export-control.component.ts`: for `format === 'pdf'` only, use `pdfInfoboxKey ?? infoboxKey`; if `getPdfSections` exists, await it FIRST, then call `getChartOptions()` / `getChartSideTable()`, skip `fetchData()` (rows = `[]`) and pass `pdfSections` into the resolved export; otherwise keep the current behaviour unchanged (depends on T003)
- [x] T006 [P] Add tests to `libs/frontend/shared-ui/src/lib/export-control/export-control.component.spec.ts`: with `getPdfSections` the PDF path awaits sections before chart options, does not call `fetchData`, and uses `pdfInfoboxKey`; CSV/XLSX/JSON paths on the same definition still call `fetchData` and ignore sections; a definition without the new fields behaves exactly as before (depends on T005)

**Checkpoint**: Contract types and control wiring in place; renderer comes next inside US1/US2 so it is test-driven by real sections

---

## Phase 3: User Story 1 - A PDF that tells the income story at a glance (Priority: P1) 🎯 MVP

**Goal**: PDF order = title/infobox → "Gross per year" chart → per-employer overview with closing "Career total" row → "Monthly overview" → "All taxes and contributions per year"; years and employers newest first; no per-payslip-part table, no file names.

**Independent Test**: Export the PDF for a user with several employers/years; verify section order and that the Career total row equals the sum over employers (and equals the on-screen career figures).

### Tests for User Story 1 ⚠️ (write first, ensure they FAIL)

- [x] T007 [P] [US1] Create exact-value tests in `libs/frontend/domain/earnings/src/lib/earnings-pdf-sections.spec.ts` with synthetic `EarningsOverview`/`EarningsTables` fixtures: employers sorted by `lastPeriod` desc (tie: `firstPeriod` desc, then label), `ALL` always last labelled with the career-total i18n label; career-total gross/net/taxes/social/bonus equal the integer-cent sum of the employer rows; net ratio taken from `CareerEntry.netRatio` (not recomputed); grid years desc with months Jan–Dec in calendar order and year sum in integer cents; tax rows sorted year desc then employer order; deductions positive; empty overview → single `text` empty-state section; single employer/year → career total equals that employer row
- [x] T008 [P] [US1] Add renderer tests in `libs/export/src/lib/pdf-exporter.spec.ts`: given `pdfSections`, the generated document definition contains title, infobox, chart image(s), then each section (title, optional subtitle, table) in order; the generic table + sum row is NOT emitted when sections are present; `emphasis: 'total'` rows are bold; `text` sections render as a paragraph; locale formatting of `currency`/`currencyWhole`/`percent`/`integer` for `de` and `en`
- [x] T009 [P] [US1] Extend `libs/frontend/domain/earnings/src/lib/earnings-export.definition.spec.ts`: definition exposes `pdfInfoboxKey = 'earnings.export.pdfInfobox'`; `getPdfSections()` calls `overview()` and `tables()` without an employer filter; `getChartOptions()` after `getPdfSections()` returns one gross-per-year option with the light palette and `[]` when there is no data; a 403 yields the empty-state section while a 503 propagates; `fetchData`/`columns`/`infoboxKey` unchanged

### Implementation for User Story 1

- [x] T010 [P] [US1] Add i18n keys in `libs/frontend/shared-ui/src/lib/i18n/translations/earnings.de.ts` and `earnings.en.ts`: `export.pdfInfobox` (describes the new structure; must not mention "one row per payslip part"), section titles (employer overview, monthly overview, taxes and contributions per year), empty-state text, and the career-total label (DE "Berufsleben gesamt", EN "Career total" — reuse `earnings.overview.wholeCareer`/`earnings.terms.*`/`earnings.tables.*` where they already match; the existing EN key is "Whole career", so add a dedicated export key if "Career total" is required)
- [x] T011 [US1] Implement pure builder `buildEarningsPdfSections(overview, tables, i18n)` in new file `libs/frontend/domain/earnings/src/lib/earnings-pdf-sections.ts` returning the employer table (columns employer, gross, net, net ratio, taxes, social, bonus; last row = career total with `emphasis: 'total'`), the monthly-overview table (year, Jan…Dec as `currencyWhole`, sum; gross metric) and the taxes-per-year table (year, employer, months, gross, bonus, tax gross, wage tax, soli, church tax, health, care, pension, unemployment, tax %, social %), applying the ordering rules from research.md §5 and the empty-state rule from §7; no source file names or corrected-figure names (depends on T007, T010)
- [x] T012 [US1] Implement section rendering in `libs/export/src/lib/pdf-exporter.ts`: after title/meta/infobox/chart images, if `pdfSections` is non-empty render each section (title, optional subtitle, table or text paragraph) in order, otherwise run the existing generic table + sum row unchanged; light print style; footer and landscape A4 unchanged (depends on T003, T008)
- [x] T013 [US1] Wire the earnings definition in `libs/frontend/domain/earnings/src/lib/earnings-export.definition.ts`: add `pdfInfoboxKey`, `getPdfSections()` (calls `overview()` + `tables()` with no filter, caches `overview.yearly`, maps 403 to the empty-state section, lets 503 propagate) and `getChartOptions()` using `grossPerYearOption(yearly, 'total', …)` with `resolveEarningsSeriesColors('light')` / `resolveChartPalette('light')`, returning `[]` without data; keep `columns`/`fetchData`/`infoboxKey` untouched (depends on T005, T011)

**Checkpoint**: User Story 1 works end to end — real export produces the new section order with correct totals

---

## Phase 4: User Story 2 - Nothing is cut off in landscape (Priority: P1)

**Goal**: Every table fully visible within landscape A4 width, long tables continue with repeated header, large amounts never truncated or broken mid-number, long employer names wrap.

**Independent Test**: Export with maximum realistic data (20 years, 8 employers, six-figure amounts, long names) and verify by text extraction and visual check that every header/value is present inside the page.

### Tests for User Story 2 ⚠️ (write first)

- [x] T014 [P] [US2] Add a width-budget unit test in `libs/export/src/lib/pdf-exporter.spec.ts` computing each section table's column-width sum (fixed + `*` shares) against the landscape A4 content width (≈ 786 pt at 28 pt margins) for the employer (7 col), grid (14 col) and tax (15 col) tables; also assert `headerRows: 1`, header repeat on page break, `dontBreakRows`, right-aligned numeric cells, `noWrap` on amounts and wrapping allowed only for label columns
- [x] T015 [P] [US2] Add an integration test in new file `libs/export/src/lib/pdf-sections.integration.spec.ts` that builds a real PDF from maximum-size synthetic sections (20 years, 8 employers, six-figure amounts like `123.456,78 €`, long employer names), extracts text with `pdfjs-dist` and asserts every column header and value string is present and every text item's x-extent lies within the page width; assert a table longer than one page repeats its header on page 2

### Implementation for User Story 2

- [x] T016 [US2] In `libs/export/src/lib/pdf-exporter.ts` implement table layout per research.md §3: explicit pdfmake widths (fixed/auto for label/year/employer columns, `*` for numeric), font size from `fontSize` hint with defaults 8 pt (employer table) and 7 pt (14/15-column tables), `headerRows: 1`, `dontBreakRows`, repeated header, right-aligned `noWrap` amounts, wrapping labels (depends on T012, T014, T015)
- [x] T017 [US2] Set the column widths/`fontSize` hints in `libs/frontend/domain/earnings/src/lib/earnings-pdf-sections.ts` per the budget in research.md §3 (year 28–30 pt, employer 96 pt in the tax table / ≈ 220 pt in the employer table, months 26 pt, numeric columns `*`), and extend `earnings-pdf-sections.spec.ts` to assert the declared widths fit the budget (depends on T011, T016)

**Checkpoint**: Max-data PDF is fully readable; US1 and US2 both pass

---

## Phase 5: User Story 3 - The PDF follows the interface language (Priority: P2)

**Goal**: A German UI yields a fully German PDF (texts, number formats); an English UI a fully English one.

**Independent Test**: Export once in DE and once in EN; no text of the other language, correct number formats (1.234,56 € vs. €1,234.56), career-total label correct.

### Tests for User Story 3 ⚠️

- [x] T018 [P] [US3] Add tests in `libs/frontend/domain/earnings/src/lib/earnings-pdf-sections.spec.ts` that build sections with the DE and the EN i18n and assert exact titles, column labels, career-total label ("Berufsleben gesamt" / "Career total"), empty-state text, and that no label from the other language appears
- [x] T019 [P] [US3] Add a locale integration test in `libs/export/src/lib/pdf-sections.integration.spec.ts` rendering the same sections with `locale: 'de'` and `'en'` and asserting extracted amounts/percents use `1.234,56 €` vs `€1,234.56` formatting, `currencyWhole` shows 0 fraction digits and percents show one decimal

### Implementation for User Story 3

- [x] T020 [US3] Apply `Intl.NumberFormat(resolved.locale)` EUR formatting for `currency`, `currencyWhole`, `percent` (one decimal, ratio input) and `integer` cell formats in `libs/export/src/lib/pdf-exporter.ts`; render missing values as `–` (depends on T012)
- [x] T021 [US3] Complete and review the DE/EN strings in `libs/frontend/shared-ui/src/lib/i18n/translations/earnings.de.ts` and `earnings.en.ts` so every PDF text (infobox, section titles, headers, empty state, career total) exists in both languages and the existing translation-parity check/test passes (depends on T010, T018)

**Checkpoint**: All Phase 1 stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Regression guards (FR-012/FR-014), UI verification, documentation

- [x] T022 [P] Add regression tests in `libs/export/src/lib/pdf-exporter.spec.ts` asserting that a `ResolvedFeatureExport` without `pdfSections` yields an unchanged document definition (generic table + sum row), covering the other six features' PDFs (FR-012, SC-006)
- [x] T023 [P] Add regression tests in `libs/frontend/domain/earnings/src/lib/earnings-export.definition.spec.ts` and `libs/export/src/lib/csv-exporter.spec.ts` / `xlsx-exporter.spec.ts` / `json-exporter.spec.ts` / `full-export-archive.spec.ts` asserting earnings CSV/XLSX/JSON and the "Export my data" archive output is unchanged and ignores `pdfSections` (FR-014)
- [x] T024 Add a performance sanity test (20 years / 8 employers PDF generated in < 3 s) to `libs/export/src/lib/pdf-sections.integration.spec.ts`
- [x] T025 Verify no amounts are logged and no source file names/corrected-figure names are emitted by the sections: add an assertion in `libs/frontend/domain/earnings/src/lib/earnings-pdf-sections.spec.ts` and grep the changed files for `console.`/logger calls (Sensitive Personal Data rule, FR-006/013)
- [x] T026 (none needed: the existing `data-testid="export-control"` is reused) Add `data-testid`s only if a new/changed interactive element meets `docs/frontend/testid-conventions.md` criteria (this change reuses the existing export control, so expected: none)
- [x] T027 Invoke the `verify-ui` skill and drive the running app with Playwright using the dedicated test user: seed ≥ 3 employers across 2010–2026, export the PDF in DE and EN, check order, newest-first, Career total row, no cut-off, repeated header on page 2+, no payslip-part table/file names, compare career total and one year with the on-screen figures; repeat in app dark mode (PDF stays light, chart legible); export CSV/XLSX/JSON and another feature's PDF and confirm unchanged (steps 1–6 of `specs/035-earnings-export-rework/quickstart.md`)
- [x] T028 Run `npm exec nx run-many -t lint test -p export frontend-shared-ui frontend-domain-earnings` and `npm exec nx affected -t build` and fix any failures
- [x] T029 [P] Update documentation affected by the change (e.g. earnings export notes under `docs/` and `specs/029-export-data/contracts/export-lib.md` cross-reference to the new PDF-sections contract; bump `libs/export` MINOR note if the lib keeps a changelog)

---

## Phase 7: Review feedback (2026-10-03)

**Purpose**: Layout and screen changes requested after the first implementation review.

- [x] T030 [US2] Start every PDF table section on a new page (chart alone on page 1) in `libs/export/src/lib/pdf-exporter.ts`, with tests in `libs/export/src/lib/pdf-exporter.spec.ts` and `libs/frontend/domain/earnings/src/lib/earnings-pdf-export.integration.spec.ts`
- [x] T031 [US1] Draw the "Gross per year" chart across the full page width in a section PDF: `pdfChartSize` on `FeatureExportDefinition`, optional size for `captureChartImage` (`libs/frontend/shared-ui/src/lib/export-control/`), wide capture size in `libs/frontend/domain/earnings/src/lib/earnings-export.definition.ts`
- [x] T032 [US1] Monthly overview shows gross and net (net below gross in each cell and in the year sum): `secondaryKey` on `PdfTableColumn`, builder in `libs/frontend/domain/earnings/src/lib/earnings-pdf-sections.ts`, title "Monthly overview gross / net" / "Monatsübersicht Brutto / Netto" plus subtitle in `earnings.de.ts` / `earnings.en.ts`
- [x] T033 On screen, make the columns of "All taxes and contributions per year" sortable (year and all amount/percentage columns; not employer or months) in `libs/frontend/domain/earnings/src/lib/tables/earnings-tables.component.ts` with `data-testid`s `earnings-taxes-sort-<key>` and tests in `earnings-tables.component.spec.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: after Setup — BLOCKS all user stories (T003 → T004/T005 → T006)
- **US1 (Phase 3)**: after Phase 2
- **US2 (Phase 4)**: after Phase 2; T016/T017 build on the renderer and builder from US1 (T012, T011), so run after US1 in practice
- **US3 (Phase 5)**: after Phase 2; T020 builds on T012, T021 on T010
- **Polish (Phase 6)**: after all stories

### User Story Dependencies

- **US1 (P1)**: independent after Foundational; delivers the MVP
- **US2 (P1)**: layout hardening of US1's renderer/builder (same files, so sequential after US1)
- **US3 (P2)**: formatting/translations; sequential on shared files with US1/US2 but independently testable
- **US4 (P2, Phase 2)**: tasked in phases 8–10 (see "Phase 2 dependencies" below)

### Within Each Story

- Tests are written first and must fail before implementation
- Types → builder/renderer → definition wiring

### Parallel Opportunities

- T002 alongside T001
- T006 after T005, alongside nothing else touching the control spec
- T007, T008, T009, T010 in parallel (different files)
- T014, T015 in parallel; T018, T019 in parallel
- T022, T023, T029 in parallel

---

## Parallel Example: User Story 1

```bash
# Tests and translations together (different files):
Task: "Exact-value tests in libs/frontend/domain/earnings/src/lib/earnings-pdf-sections.spec.ts"
Task: "Renderer tests in libs/export/src/lib/pdf-exporter.spec.ts"
Task: "Definition tests in libs/frontend/domain/earnings/src/lib/earnings-export.definition.spec.ts"
Task: "i18n keys in libs/frontend/shared-ui/src/lib/i18n/translations/earnings.{de,en}.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 (US1): new section order, correct totals and ordering
3. **STOP and VALIDATE**: export a real PDF, check order and Career total against the screen

### Incremental Delivery

1. Foundation → US1 (content/order) → US2 (nothing cut off — required before shipping since the cut-off is the reported defect) → US3 (language hardening)
2. US1 + US2 are both P1 and should ship together; US3 follows
3. Phase 2 formats (US4) only after amending the spec

---

## Notes

- [P] tasks = different files, no dependencies
- Only the PDF changes: other features' PDFs and all non-PDF earnings formats must stay byte-for-byte/content-wise unchanged
- Commit after each task or logical group; use `npm`/`npx` (not pnpm) for Nx commands

---

# Phase 2 — CSV, Excel, JSON and archive (amended 2026-10-03)

Specs: `spec.md` User Story 4, FR-016–FR-025, SC-007–SC-009 · Design: `plan.md`, `research.md` §9–18, `data-model.md` (Phase 2), `contracts/export-tables.md`.

**No backend change** (still no controller/DTO/route): no OpenAPI task applies.

## Phase 8: Phase 2 Foundation (shared model, single report)

**Purpose**: The neutral table types and the one computation both the PDF and the new tables use. After this phase the PDF output must be byte-for-byte what Phase 1 produced.

**⚠️ CRITICAL**: No US4 format work can begin until T035 and T038 are done.

- [ ] T034 Run `npm exec nx test export`, `npm exec nx test frontend-shared-ui` and `npm exec nx test frontend-domain-earnings` and confirm they are green on the Phase 1 baseline (so any later PDF difference is attributable)
- [ ] T035 Add the types `ExportTableColumnFormat`, `ExportTableColumn`, `ExportTableRow`, `ExportTable`, the optional `tables?` on `ResolvedFeatureExport` and the optional `getExportTables?()` on `FeatureExportDefinition` exactly as in `specs/035-earnings-export-rework/contracts/export-tables.md` in `libs/export/src/lib/feature-export-definition.ts`, and export them from `libs/export/src/index.ts`
- [ ] T036 [P] Write failing exact-value tests for `buildEarningsReport` in `libs/frontend/domain/earnings/src/lib/earnings-report.spec.ts`: employers ordered by recency with the `ALL` entry (or the single employer) as `total`; career total = sum of employer rows in integer cents; month grid years newest first with 12 gross + 12 net cells, exact integer-cent gross/net sums, missing months stay `null`; tax rows year desc then employer recency; yearly series newest first; no data → empty parts (depends on T034)
- [ ] T037 Create `libs/frontend/domain/earnings/src/lib/earnings-report.ts` with the pure `buildEarningsReport(overview, tables)` per `data-model.md` (move the ordering/summing logic out of `earnings-pdf-sections.ts`; reuse `gridRows`) so T036 passes (depends on T036)
- [ ] T038 Refactor `libs/frontend/domain/earnings/src/lib/earnings-pdf-sections.ts` to project from `buildEarningsReport` instead of computing rows itself; the unchanged existing `earnings-pdf-sections.spec.ts` and `earnings-pdf-export.integration.spec.ts` must stay green without edits (PDF unchanged) (depends on T037)

**Checkpoint**: Types and report in place; PDF still identical.

---

## Phase 9: User Story 4 - CSV, Excel and JSON deliver the same content as the PDF (Priority: P2)

**Goal**: Earnings Excel (sheet per table), CSV (ZIP, file per table), JSON (named sections) and the "Export my data" archive carry the PDF's four tables with the same figures; gross and net in separate columns; stable JSON keys; no per-payslip rows.

**Independent Test**: Export all three formats and the PDF for the same synthetic data in DE and EN; figures (career total, one year, one employer) match across formats and the screen; JSON key sets are identical in DE and EN; the archive's `earnings/` folder has the same content.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [ ] T039 [P] [US4] Add exact-value tests in `libs/frontend/domain/earnings/src/lib/earnings-export-tables.spec.ts` for `toExportTables(report, t)`: four tables with ids `grossPerYear`, `employers`, `monthlyOverview`, `taxesPerYear` in PDF order; `employers` has `totalKey: 'careerTotal'` and the total row last with `emphasis: 'total'`; monthly overview has 28 columns with keys `year`, `gross01…gross12`, `grossTotal`, `net01…net12`, `netTotal` and `null` for missing months; money/ratio stay canonical strings (ratios as fractions); column keys identical for DE and EN while labels/titles differ; empty report → four tables with columns and zero rows; **parity test**: every figure in `buildEarningsPdfSections` equals the same figure in `toExportTables` for the same report (FR-017, SC-007)
- [ ] T040 [P] [US4] Add JSON tests in `libs/export/src/lib/json-exporter.spec.ts`: with `tables` the output is one object keyed by `table.id`, rows keyed by column `key` (not label), the `totalKey` row is moved out of the list (`null` when absent), money stays a string, integers numbers, section order = array order; without `tables` the output is byte-for-byte the existing one
- [ ] T041 [P] [US4] Add Excel tests in `libs/export/src/lib/xlsx-exporter.spec.ts` (re-read the blob with `exceljs`): one sheet per table in order, sheet names ≤ 31 chars with `[]:*?/\` removed and duplicates suffixed, `money` cells are numbers with format `#,##0.00 "€"`, `ratio` `0.0%`, `integer` numeric, `null` empty, header row bold and frozen, total row bold, header-only sheet for zero rows; without `tables` unchanged
- [ ] T042 [P] [US4] Add CSV tests in `libs/export/src/lib/csv-exporter.spec.ts` (re-read the ZIP with `jszip`): one `NN-<slug>.csv` per table in order (slug ASCII-folded, lower-case, hyphenated), UTF-8 BOM, RFC 4180 quoting and CRLF, header row of labels, money verbatim dot-decimal strings, `null` empty, total row last, header-only file for zero rows; a shared per-table builder is exported for the archive; without `tables` the plain `.csv` is unchanged
- [ ] T043 [P] [US4] Add tests in `libs/export/src/lib/export-feature.spec.ts` for `exportFileExtension`: `'zip'` for `csv` with `tables`, otherwise the format itself (`csv` without tables, `xlsx`, `json`, `pdf`), and that `exportFeature(..., 'csv')` returns an `application/zip` blob with `tables`
- [ ] T044 [P] [US4] Add tests in `libs/frontend/shared-ui/src/lib/export-control/export-control.component.spec.ts`: for `json`/`csv`/`xlsx` a definition with `getExportTables` awaits it, does not call `fetchData`, passes `tables`, and the download name uses `exportFileExtension` (`.zip` for CSV); the PDF path ignores `getExportTables`; a definition without it behaves exactly as before
- [ ] T045 [P] [US4] Add tests in `libs/export/src/lib/full-export-archive.spec.ts`: a definition with `getExportTables` writes `<id>/<id>.json`, `<id>/<id>.xlsx` from the tables, the CSV table files flat into `<id>/` (no nested ZIP) and its PDF from `getPdfSections`; a failing `getExportTables` records all formats of that feature as failures; other features' entries are unchanged

### Implementation for User Story 4

- [ ] T046 [US4] Create `libs/frontend/domain/earnings/src/lib/earnings-export-tables.ts` with the pure `toExportTables(report, t)` per `data-model.md` ("Earnings export tables"): stable ids/column keys, translated labels/titles, separate gross/net columns, `totalKey: 'careerTotal'`, the 28-column monthly overview, `grossPerYear` from the yearly series (depends on T037, T039)
- [ ] T047 [P] [US4] Implement the `tables` branch of `exportJson` in `libs/export/src/lib/json-exporter.ts` per `contracts/export-tables.md`; generic path untouched (depends on T035, T040)
- [ ] T048 [P] [US4] Implement the `tables` branch of `exportXlsx` in `libs/export/src/lib/xlsx-exporter.ts` per `contracts/export-tables.md` (sheet names, number formats, frozen bold header, bold total row, auto-filter over header + data rows, column widths); keep the deferred `import('exceljs')`; generic path untouched (depends on T035, T041)
- [ ] T049 [P] [US4] Implement in `libs/export/src/lib/csv-exporter.ts`: an exported per-table builder `exportTableCsvFiles(tables): { name: string; content: string }[]` (BOM, RFC 4180, CRLF, `NN-<slug>.csv`) and the `tables` branch of `exportCsv` returning a ZIP via a deferred `import('jszip')`; generic path stays a synchronous plain CSV (depends on T035, T042)
- [ ] T050 [US4] Add `exportFileExtension(resolved, format)` to `libs/export/src/lib/export-feature.ts`, route `exportFeature` through the (now possibly async) CSV path, and export it plus the CSV table builder from `libs/export/src/index.ts` (depends on T049, T043)
- [ ] T051 [US4] Wire `ExportControlComponent` in `libs/frontend/shared-ui/src/lib/export-control/export-control.component.ts`: for non-PDF formats, if `getExportTables` exists await it, skip `fetchData()` (rows = `[]`), pass `tables`; use `exportFileExtension` for the download file name; PDF path and definitions without the new function unchanged (depends on T050, T044)
- [ ] T052 [US4] Extend `exportAll` in `libs/export/src/lib/full-export-archive.ts` and its caller `apps/frontend/src/app/settings/profile/profile.component.ts` per `research.md` §16: resolve `tables` (and `pdfSections`, PDF infobox key, chart size) for definitions that provide them, write JSON/XLSX from the tables, write the CSV table files flat into `<featureId>/`, and render the PDF from the sections; adjust the `ResolveLabels` result type backward compatibly (depends on T050, T045)
- [ ] T053 [US4] In `libs/frontend/domain/earnings/src/lib/earnings-export.definition.ts`: add `getExportTables()` (`overview()` + `tables()` without employer filter → `buildEarningsReport` → `toExportTables`; 403 → the four tables with zero rows; 503 propagates), build `getPdfSections` on the same report, and retire the per-payslip export (`toExportRow`, `AMOUNT_COLUMNS`/`COLUMNS`, the `fetchData` body) leaving `columns: []` and `fetchData: async () => []` with a one-line comment. First confirm no other caller of `toExportRow` with `npx codegraph callers "toExportRow"` (depends on T046)
- [ ] T054 [US4] Add the new DE/EN strings to `libs/frontend/shared-ui/src/lib/i18n/translations/earnings.de.ts` and `earnings.en.ts`: table titles/sheet names (Gross per year, Employers, Monthly overview, Taxes and contributions per year), month-column labels for gross and net ("Brutto Januar" … / "Gross January" …, totals), yearly-series column labels (months employed, regular, …); reuse existing `earnings.terms.*`/`earnings.tables.*` keys where they exist; the translation-parity check must pass (depends on T039)
- [ ] T055 [US4] Replace the earnings part of Phase 1's T023: in `libs/frontend/domain/earnings/src/lib/earnings-export.definition.spec.ts` remove the assertions for the per-payslip rows/columns and add ones for `getExportTables` (four tables, 403 → zero rows, 503 propagates, no employer filter, `fetchData` returns `[]`) and `pdfSections` still produced (depends on T053)
- [ ] T056 [US4] Add an integration test `libs/frontend/domain/earnings/src/lib/earnings-tables-export.integration.spec.ts` that builds the earnings definition on synthetic maximum-size data (20 years, 8 employers, long names, six-figure amounts) and runs the real `exportFeature` for `json`, `xlsx` and `csv` in DE and EN: JSON key sets identical across languages, career total and one year equal across JSON, XLSX, CSV and the PDF sections (exact values), no cell/field of the old per-payslip shape (no file names, no corrected-figure names), empty data → valid empty output (FR-024, SC-007–SC-009) (depends on T047–T053)

**Checkpoint**: All four formats and the archive emit the same four tables.

---

## Phase 10: Polish & Cross-Cutting (Phase 2)

- [ ] T057 [P] Verify FR-025: other features' CSV/XLSX/JSON, the generic archive entries and every non-earnings PDF are unchanged — the existing specs of `csv-exporter`, `xlsx-exporter`, `json-exporter`, `full-export-archive`, `pdf-exporter` must pass unmodified for the generic path; add a regression test per exporter if a generic-path assertion is missing in `libs/export/src/lib/*.spec.ts`
- [ ] T058 [P] Sensitive-data check: add assertions in `libs/frontend/domain/earnings/src/lib/earnings-export-tables.spec.ts` that no column/field carries source file names, corrected-figure names, issue dates or payslip kinds, and grep the changed files for `console.`/logger calls (FR-016, Sensitive Personal Data rule)
- [ ] T059 Invoke the `verify-ui` skill and drive the running app with Playwright using the dedicated test user, following "Phase 2 validation" in `specs/035-earnings-export-rework/quickstart.md`: Excel, CSV ZIP, JSON in DE and EN, compare figures with the PDF and the screen, diff the JSON key sets, the "Export my data" archive's `earnings/` folder, an empty/forbidden account, and another feature's exports unchanged. No new interactive element is added, so no new `data-testid` is expected (T026 reasoning)
- [ ] T060 Run `npm exec nx run-many -t lint test -p export frontend-shared-ui frontend-domain-earnings frontend` and `npm exec nx affected -t build` and fix any failures
- [ ] T061 [P] Update documentation: cross-reference `contracts/export-tables.md` from `specs/029-export-data/contracts/export-lib.md`, document the new earnings JSON/CSV/Excel format (including the stable JSON keys) where the export is described under `docs/`, and add the release note "earnings JSON/CSV/Excel format changed (no per-payslip rows)"; note the `libs/export` MINOR bump if the lib keeps a changelog
- [ ] T062 Run `speckit-sonar-validate` (quality gate for the branch) once the changes are pushed and fix reported issues in the new exporter and report code

---

## Phase 2 dependencies & execution order

- **Phase 8** blocks Phase 9: T034 → T035; T034 → T036 → T037 → T038.
- **Phase 9 tests** (T039–T045) can be written in parallel once T035 exists; T039 needs T037.
- **Exporters** T047, T048, T049 are independent files (parallel); T050 follows T049; T051 and T052 follow T050; T046 follows T037/T039; T053 follows T046; T054 follows T039; T055/T056 close the story after T053.
- **Phase 10** after Phase 9; T059 needs a running app, T062 needs the branch pushed.
- **Parallel opportunities**: T036 ∥ T035; T039–T045 all [P]; T047 ∥ T048 ∥ T049; T057 ∥ T058 ∥ T061.

## Implementation strategy (Phase 2)

1. **MVP slice**: Phase 8, then JSON (T040, T046, T047, T053 partial) — smallest end-to-end path proving the single-source model and the stable keys.
2. Add Excel (T041, T048), then CSV ZIP (T042, T049, T050, T051), verifying figures against the PDF each time.
3. Archive (T045, T052) and the i18n/retirement tasks (T054, T055) last, then integration (T056) and polish (T057–T062).
