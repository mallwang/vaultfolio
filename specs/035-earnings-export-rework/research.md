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
