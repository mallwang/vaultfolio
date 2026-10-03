# Quickstart: validating the earnings PDF rework

## Automated

```bash
npm exec nx test export
npm exec nx test frontend-shared-ui
npm exec nx test frontend-domain-earnings
```

Expected: exact-value tests for career total = sum of employers, employer/year ordering, grid sums, tax rows; exporter tests render a real PDF from maximum-size synthetic data (20 years, 8 employers, six-figure amounts, long names), extract its text with `pdfjs-dist` and assert every header/value is present and inside the page width; regression tests prove generic PDFs of other features and CSV/XLSX/JSON of earnings are unchanged.

## Manual (verify-ui skill, Playwright against the running app, test user)

1. Seed or import synthetic payslips for ≥ 3 employers across 2010–2026.
2. Earnings → Export → PDF, with UI language **Deutsch**, then **English**.
3. Check the downloaded PDF: order chart → employer overview (last column "Berufsleben gesamt"/"Career total") → Monatsübersicht → Alle Steuern und Abgaben pro Jahr; years newest first; employers newest first; no table cut off; header repeats on page 2+; no per-payslip-part table, no file names.
4. Compare the career total gross and one year's row with the on-screen figures.
5. Switch the app to dark mode and export again: PDF is still light with a legible chart.
6. Export CSV/XLSX/JSON of earnings and the PDF of another feature: unchanged.
