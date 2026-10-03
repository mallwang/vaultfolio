---
description: 'Task list for 035 Earnings Export Rework (Phase 1: PDF)'
---

# Tasks: Earnings Export Rework

**Input**: Design documents from `/specs/035-earnings-export-rework/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/export-pdf-sections.md, quickstart.md

**Tests**: Included. The plan and constitution (Principles III/IV) require exact-value unit tests and an exporter integration test; no tolerance assertions, synthetic data only.

**Scope**: Phase 1 only (PDF). User Story 4 (Phase 2, other formats) is deliberately not tasked — per FR-015 it must first be specified by amending the spec. T022/T023 guard that non-PDF output stays unchanged (FR-014).

**No backend change**: no controller/DTO/route is touched, so no OpenAPI task applies.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (income-story PDF), US2 (nothing cut off), US3 (language)

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
- **US4 (P3, Phase 2)**: not tasked here; requires spec amendment first (FR-015)

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
