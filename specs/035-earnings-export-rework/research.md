# Research: Earnings Export Rework

## 1. Where does the PDF data come from?

- **Decision**: Build all PDF sections from `EarningsService.overview()` (`career`, `yearly`) and `EarningsService.tables()` (`monthGrid`, `taxesPerYear`), called **without** an employer filter.
- **Rationale**: These are exactly the read models behind the on-screen "Gross per year", career summary, "Monatsübersicht" and "Alle Steuern und Abgaben pro Jahr"; reusing them guarantees FR-010/SC-004 (PDF = screen) and needs no backend change or new aggregation logic. `CareerEntry` already carries per-employer totals, months employed, first/last period and the `ALL` career entry; `TaxYearRow` already carries the 15 tax columns.
- **Alternatives**: Re-aggregate from `GET /earnings/records` client-side (rejected: duplicates server aggregation, risks drift from screen); new backend export endpoint (rejected: API change for no gain, violates YAGNI).

## 2. How to give the shared PDF exporter a multi-section layout?

- **Decision**: Add an optional `pdfSections: PdfSection[]` to `ResolvedFeatureExport` (union: `table`, `text`) and to `FeatureExportDefinition` an optional `getPdfSections(): Promise<PdfSection[]>` plus optional `pdfInfoboxKey`. `ExportControlComponent` resolves them only for `format === 'pdf'`. If `pdfSections` is present, `exportPdf` renders them after title/infobox/chart; otherwise the existing generic table path runs unchanged.
- **Rationale**: Additive, backward compatible (FR-012); the other 6 features' definitions and tests stay untouched; non-PDF exporters ignore the field (FR-014). Definitions already inject `I18nService`, so they can return already-translated section content, keeping `libs/export` free of Angular (Library-First).
- **Alternatives**: Earnings-specific exporter outside `libs/export` (rejected: duplicates font/locale/page setup, splits PDF logic); multiple `FeatureExportDefinition`s per feature (rejected: the registry/UI assume one per feature).

## 3. Fitting every table on a landscape page

- **Decision**: Tables get explicit pdfmake column widths: a fixed/auto width for label/year/employer columns and equal `*` widths for numeric columns; font size by table density (8 pt employer table, 7 pt for the 15-column tax table and 14-column grid); `headerRows: 1` + `dontBreakRows` + header repeat on page break; numeric cells right-aligned, `noWrap` for amounts, wrapping allowed only for labels (employer names). The year × month grid shows **whole euros** (as the on-screen grid does); the tax table shows euros with cents as on screen. Page margins 28 pt left/right on landscape A4 (≈ 786 pt content width).
- **Budget check**: tax table = year 28 + employer 96 + months 26 + 12 amounts + 2 percent columns ≈ 14 × ~45 pt = 630 pt → 780 pt total; a value like `123.456,78 €` at 7 pt ≈ 44 pt. Grid = year 30 + 12 × 48 + sum 56 = 662 pt. Employer table: 7 fixed columns (employer ≈ 220 pt, six value columns of ≈ 90 pt) — comfortably within width at 8 pt; the number of employers only adds rows (flowing onto further pages with the repeated header), never columns.
- **Verification**: pdfmake does not report overflow, so layout is asserted by (a) a unit test computing the width budget from the section definition, and (b) an integration test extracting text with `pdfjs-dist` (already a dependency) from a PDF built from the maximum realistic data and asserting every header/value string is present and each text item's x-extent lies within the page. Plus a visual check via `verify-ui`.
- **Alternatives**: Auto widths only (rejected: unpredictable, caused the current cut-off); scaling the whole table (rejected: tiny, unreadable text); portrait (rejected by requirement).

## 4. Chart in the PDF

- **Decision**: Reuse `grossPerYearOption(yearly, 'total', …)` with the **light** palette (`resolveEarningsSeriesColors('light')`, `resolveChartPalette('light')`), supplied through `getChartOptions()`; captured by the existing `captureChartImage` on a white background. Chart data = full `yearly`, all years, ascending on the x-axis (time axis convention of the screen chart; the newest-first rule applies to tables).
- **Rationale**: Same data and visuals as the screen chart (FR-002) and legible regardless of dark mode (edge case). `getChartOptions` is sync and is called after `fetchData`; since earnings' PDF path skips generic `fetchData`, the definition caches the overview in `getPdfSections()`—so the order must be: `getPdfSections()` first, then `getChartOptions()`. The export control will be adjusted to await sections before reading chart options (documented in the contract).
- **Alternatives**: Capture the on-screen chart element (rejected: not mounted on other pages, theme-dependent).

## 5. Ordering rules

- **Decision**: Employers sorted by `lastPeriod` desc, ties by `firstPeriod` desc, then label; `ALL` is separated out and always last. Tax rows sorted by `year` desc, then `lastPeriod`-based employer order (same employer order as above), then label. Grid years sorted desc; month columns stay January–December (calendar order), as on screen.
- **Rationale**: Matches "neu → alt" for years and employers (FR-003/005) without reordering the natural month axis.

## 6. PDF-specific infobox and removed columns

- **Decision**: New translation key `earnings.export.pdfInfobox` (DE/EN) describing the new structure, selected via `pdfInfoboxKey`; the existing `earnings.export.infobox` stays for CSV/XLSX/JSON ("one row per payslip part" remains true there). The PDF contains no source file names, no corrected-figure names, no certificate table, and no payslip-part rows.
- **Rationale**: FR-006/013/014; the old infobox text would be wrong for the PDF.

## 7. Empty / unavailable states

- **Decision**: `getPdfSections()` returns a single `text` section with a translated empty message when `overview.hasData` is false or when the API answers 403 (member without access); 503 `EARNINGS_UNAVAILABLE` propagates as today (export fails visibly rather than producing wrong figures — fail closed). The chart is omitted when there is no data.
- **Rationale**: FR-011 and the Earnings fail-closed rule.

## 8. Number formats and labels

- **Decision**: Section cells carry typed values (`currency` / `percent` / `integer` / `text`) and the exporter formats them with `resolved.locale` (`de`/`en`), like the generic path. Labels reuse existing `earnings.terms.*` / `earnings.tables.*` / `earnings.overview.wholeCareer` keys (DE "Berufsleben gesamt"); the English "Career total" label is added if the current EN key differs. Ratios use the existing percent formatting.
- **Rationale**: FR-009/SC-005; avoids duplicating translation strings.

---

# Phase 2 research (CSV / Excel / JSON, amended 2026-10-03)

## 9. One data source for all formats

- **Decision**: Extract the row computation of the Phase 1 builders (employer ordering, career-total row, month grid with gross and net, tax rows, yearly series) into a pure `buildEarningsReport(overview, tables)`. `earnings-pdf-sections.ts` and the new `earnings-export-tables.ts` are thin projections of that report (PDF: combined cells such as net below gross, whole-euro display; export tables: separate columns, stable keys).
- **Rationale**: FR-017 / SC-007 — PDF and all other formats show the same numbers by construction; a parity test compares both projections cell by cell. No second aggregation path.
- **Alternatives**: derive the export tables from the `PdfSection[]` (rejected: PDF columns carry display decisions — merged cells, whole euros, `m1..m12` keys — that must not leak into a stable format); keep two independent builders (rejected: drift risk).

## 10. Neutral table model in the shared capability

- **Decision**: Add `ExportTable { id, title, columns: ExportTableColumn[], rows: ExportTableRow[], totalKey? }` (columns typed `text | integer | money | ratio`, `key` stable and language-independent, `label`/`title` already translated) as optional `ResolvedFeatureExport.tables`, supplied by an optional `FeatureExportDefinition.getExportTables()`. When present, JSON/CSV/XLSX serialize the tables instead of `rows`; PDF ignores them (it has `pdfSections`). Absent → exact current behaviour for all other features.
- **Rationale**: Additive and backward compatible (FR-025); `libs/export` stays framework-free; `ExportControlComponent` and the archive only need to await one more optional function. Money stays a canonical decimal string in the model (Principle III).
- **Alternatives**: reuse `PdfSection` (rejected, see 9); one `FeatureExportDefinition` per table (rejected: registry and UI assume one per feature).

## 11. Excel: one sheet per table

- **Decision**: `exportXlsx` with `tables` writes one worksheet per table in PDF order. Sheet names = translated titles, stripped of `[]:*?/\`, cut to 31 characters, de-duplicated with a numeric suffix. `money` → numeric cell, number format `#,##0.00 "€"`; `ratio` → numeric fraction, format `0.0%`; `integer` → numeric, `0`; `text` → string; `null` → empty cell. Header row bold and frozen (`views: [{ state: 'frozen', ySplit: 1 }]`); the `emphasis: 'total'` row is bold; column widths from header and content length; an auto-filter covers the header and data rows only, not the total row.
- **Rationale**: FR-018; numeric cells make the workbook directly usable for sums and charts; Excel renders `#,##0.00` in the user's own locale, so the file needs no locale handling.
- **Alternatives**: all tables stacked on one sheet (rejected: breaks filtering and pivots); text-formatted amounts (rejected: not machine-readable, FR-022).

## 12. CSV: ZIP with one file per table

- **Decision**: With `tables`, `exportCsv` returns a ZIP blob (`jszip`, lazy-imported like the archive) containing `NN-<slug>.csv` per table, `NN` = two-digit position (PDF order), `<slug>` = ASCII-folded, lower-case, hyphenated translated title (e.g. `01-brutto-pro-jahr.csv`, `02-arbeitgeber.csv`). Each file: UTF-8 **with BOM** (so Excel shows umlauts correctly), RFC 4180 quoting and CRLF as the existing CSV exporter, comma separator, header row of translated labels, money as dot-decimal canonical string (no locale formatting, no currency sign), ratios as fraction strings, empty cell for `null`, the total row last. The generic (non-table) CSV path stays a plain `.csv`. `exportFileExtension(resolved, format)` tells the caller to download `<title>.zip`.
- **Rationale**: FR-019/FR-022; BOM is the least surprising choice for the primary consumer (German Excel) without touching the field syntax. Locale-independent numbers keep the files importable everywhere.
- **Alternatives**: single CSV with sections or "long" format (rejected by the product owner in favour of the ZIP); semicolon/comma-decimal CSV for German Excel (rejected: breaks the shared RFC 4180 convention and machine use).

## 13. JSON: object with stable section keys

- **Decision**: With `tables`, `exportJson` writes one object: `{ "<table.id>": [ {<column.key>: value, …}, … ], … }`. A table with `totalKey` moves its `emphasis: 'total'` row out of the list into `"<totalKey>"` (`null` when there is no total). Keys are the stable ids/column keys, never labels; money = canonical decimal string, ratios = fraction string, integers = numbers, missing = `null`. Section order = PDF order. Earnings ids: `grossPerYear`, `employers` (+ `careerTotal`), `monthlyOverview`, `taxesPerYear`. No envelope or version field (YAGNI); additions are non-breaking by adding keys.
- **Rationale**: FR-020/SC-009 — identical keys in German and English; natural for scripts. Documented in `contracts/export-tables.md`.
- **Alternatives**: array of `{title, columns, rows}` (rejected: language-dependent, harder to consume); nested months objects for the monthly overview (rejected: a second shape to explain; flat stable keys keep one projection rule).

## 14. Monthly overview shape outside the PDF (open point from the spec)

- **Decision**: Keep the on-screen/PDF shape: one row per year (newest first); columns `year`, `gross01 … gross12`, `grossTotal`, `net01 … net12`, `netTotal` (28 columns). Labels in Excel/CSV: "Brutto Januar" … / "Gross January" …, "Brutto Summe", "Netto Januar" … Month columns are calendar-ordered. Values are the underlying decimals with cents (the PDF's whole-euro rounding is display-only); the year sum is the exact integer-cent sum, as on screen.
- **Rationale**: Matches the user's mental model and the PDF; one row per year is directly pivotable, and a long form (year, month, gross, net) can be derived trivially by consumers. Missing months are `null`/empty, never `0`.
- **Alternatives**: long form (rejected: differs from the PDF/screen shape the spec asks to mirror); gross and net as two stacked blocks (rejected: breaks one-row-per-year).

## 15. The other three tables outside the PDF

- **Gross per year**: one row per year, newest first (tables are newest-first throughout), columns `year`, `monthsEmployed`, `gross`, `regular`, `bonus`, `net`, `taxes`, `social`, `taxRatio`, `socialRatio` — the full `YearlyPoint` behind the chart (the chart itself is not exported as an image).
- **Employers**: `employer`, `gross`, `net`, `netRatio`, `taxes`, `social`, `bonus` as in the PDF; employers newest first; the career total is the last row (`emphasis: 'total'`, JSON `careerTotal`). With one employer the total equals that employer's row, as in the PDF.
- **Taxes per year**: same columns and ordering as the PDF table (year desc, then employer recency).

## 16. "Export my data" archive

- **Decision**: In `exportAll`, a definition with `getExportTables` gets `tables` (awaited before the formats run; failure counts like a fetch failure today); JSON/XLSX write `earnings/earnings.json` / `earnings/earnings.xlsx` from them; CSV writes the per-table CSV files **flat** into `earnings/` (`earnings/01-brutto-pro-jahr.csv`, …) — no nested ZIP. The earnings PDF in the archive uses `getPdfSections` + chart like the single export (today the archive would otherwise render an empty generic table, because earnings no longer provides per-payslip rows). Other features: `fetchData` path unchanged.
- **Rationale**: FR-023; a ZIP inside a ZIP is awkward, and the files are identical to the single export's. The shared per-table CSV builder is the only code path (single source).
- **Alternatives**: nested `earnings.zip` (rejected: awkward for users); dropping the earnings PDF from the archive (rejected: silent loss, out of scope).

## 17. Retiring the per-payslip export

- **Decision**: `toExportRow`, `AMOUNT_COLUMNS`/`COLUMNS` and the `fetchData` implementation in the earnings definition are removed; the definition keeps `columns: []` and `fetchData: async () => []` only to satisfy the still-required interface fields (documented in a one-line comment). Their callers/tests (`earnings-export.definition.spec.ts`, regression tests T022/T023 of Phase 1) are replaced by Phase 2 assertions. Callers of `toExportRow` are checked with CodeGraph before removal (task).
- **Rationale**: FR-016 (no per-payslip rows, file names or corrected-figure names in any format) and data minimization; dead code is not kept.
- **Alternatives**: keep the old rows behind a hidden option (rejected: nobody asked, privacy surface).

## 18. Empty and forbidden states

- **Decision**: No data or 403 → `getExportTables()` returns the four tables with columns and zero rows (JSON: empty arrays, `careerTotal: null`; Excel: header-only sheets; CSV: header-only files). 503 propagates (fails visibly), as in the PDF.
- **Rationale**: FR-024; keeps consumers' schema stable and matches the archive rule that every feature appears even without entitlement.
