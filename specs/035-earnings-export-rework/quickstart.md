# Quickstart: validating the earnings PDF rework

## Automated

```bash
npm exec nx test export
npm exec nx test frontend-shared-ui
npm exec nx test frontend-domain-earnings
```

Expected: exact-value tests for career total row = sum of employers, employer/year ordering, grid sums, tax rows; exporter tests render a real PDF from maximum-size synthetic data (20 years, 8 employers, six-figure amounts, long names), extract its text with `pdfjs-dist` and assert every header/value is present and inside the page width; regression tests prove generic PDFs of other features and CSV/XLSX/JSON of earnings are unchanged.

## Manual (verify-ui skill, Playwright against the running app, test user)

1. Seed or import synthetic payslips for ≥ 3 employers across 2010–2026.
2. Earnings → Export → PDF, with UI language **Deutsch**, then **English**.
3. Check the downloaded PDF: order chart → employer overview (one row per employer, last row "Berufsleben gesamt"/"Career total") → Monatsübersicht → Alle Steuern und Abgaben pro Jahr; years newest first; employers newest first; no table cut off; header repeats on page 2+; no per-payslip-part table, no file names.
4. Compare the career total row and one year's row with the on-screen figures.
5. Switch the app to dark mode and export again: PDF is still light with a legible chart.
6. Export CSV/XLSX/JSON of earnings and the PDF of another feature: unchanged.

---

# Phase 2 validation (CSV / Excel / JSON, amended 2026-10-03)

## Automated

```bash
npm exec nx test export
npm exec nx test frontend-shared-ui
npm exec nx test frontend-domain-earnings
```

Expected additionally: exact-value tests for `buildEarningsReport` and both projections; a parity test (every figure in `PdfSection[]` equals the same figure in `ExportTable[]`); round-trip tests — XLSX re-read with `exceljs` (sheet names/count, numeric cells, frozen header, bold total row), CSV ZIP re-read with `jszip` (file names/order, BOM, RFC 4180, header-only for empty), JSON parsed (stable keys identical for `de` and `en`, `careerTotal`, decimal strings); generic exporter output of other features byte-for-byte unchanged; archive test (earnings JSON/XLSX from tables, CSV files flat in `earnings/`, other features unchanged).

## Manual (verify-ui, Playwright, test user)

1. Same seeded data as the PDF check (≥ 3 employers, 2010–2026).
2. Earnings → Export → **Excel**: four sheets in PDF order; amounts are numbers (sum a column in Excel to check); header frozen; career total last row of the employers sheet; net in its own columns.
3. **CSV**: a `.zip` downloads with four CSV files; open one in Excel — umlauts correct, columns split.
4. **JSON**: one document with `grossPerYear`, `employers`, `careerTotal`, `monthlyOverview`, `taxesPerYear`; export once in DE and once in EN and diff the key sets (identical).
5. Compare career total and one year across PDF, Excel, CSV, JSON and the screen.
6. Settings → Profile → "Export my data": the archive's `earnings/` folder has `earnings.json`, `earnings.xlsx`, the four CSV files and the PDF in the new format; another feature's files are unchanged.
7. Empty account / member without Earnings access: header-only sheets/files, JSON with empty arrays and `careerTotal: null`, no error.

Release note: the earnings JSON/CSV/Excel format changed (no per-payslip rows any more).
