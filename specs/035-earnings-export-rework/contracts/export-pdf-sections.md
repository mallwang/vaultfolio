# Contract: PDF sections in the shared export capability

Extends `specs/029-export-data/contracts/export-lib.md`. Version impact: `libs/export` MINOR (additive optional fields).

## Types (`@vaultfolio/export`)

```ts
export type PdfColumnFormat = 'text' | 'currency' | 'currencyWhole' | 'percent' | 'integer';

export interface PdfTableColumn {
  key: string;
  label: string; // already translated
  format: PdfColumnFormat;
  width?: number | 'auto' | '*';
  align?: 'left' | 'right';
}

export interface PdfTableRow {
  cells: Record<string, string | number | null>; // decimals as canonical strings
  emphasis?: 'total';
}

export type PdfSection =
  | { kind: 'table'; title: string; subtitle?: string; columns: PdfTableColumn[]; rows: PdfTableRow[]; fontSize?: number; emphasizeLastColumn?: boolean }
  | { kind: 'text'; title?: string; text: string };

// FeatureExportDefinition (additions)
getPdfSections?(): Promise<PdfSection[]>;
pdfInfoboxKey?: string;

// ResolvedFeatureExport (addition)
pdfSections?: PdfSection[];
```

## Behaviour

1. `ExportControlComponent`, for `format === 'pdf'` only:
   - uses `pdfInfoboxKey ?? infoboxKey`;
   - if `getPdfSections` exists: awaits it **first**, then `getChartOptions()` / `getChartSideTable()`, and does **not** call `fetchData()` (rows = `[]`);
   - otherwise unchanged.
2. `exportPdf`: title, meta, infobox, chart images, then — if `pdfSections` is set and non-empty — each section in order (section title, optional subtitle, table); otherwise the existing generic table + sum row. Footer unchanged. Landscape A4.
3. Table rendering guarantees: all columns inside the content width; explicit column widths (label columns fixed/auto, numeric `*`); numeric cells right-aligned and never wrapped; header row repeated on page break; rows not split across pages; `emphasizeLastColumn` bolds the last column; `emphasis: 'total'` bolds the row.
4. Locale: numbers via `Intl.NumberFormat(resolved.locale)`, EUR; `currencyWhole` has 0 fraction digits; `percent` takes a ratio string/number and renders one decimal.
5. Non-PDF exporters ignore `pdfSections`. Features not providing the new fields are byte-for-byte unaffected (regression test).
6. Empty/forbidden: definitions return a single `text` section (translated) instead of empty tables.

## Earnings usage (`createEarningsExportDefinition`)

- `pdfInfoboxKey: 'earnings.export.pdfInfobox'`.
- `getPdfSections()`: `overview()` + `tables()` (no employer filter) → `buildEarningsPdfSections(overview, tables, i18n)`; caches `overview.yearly` for `getChartOptions()`.
- `getChartOptions()`: `[grossPerYearOption(yearly, 'total', lightColors, labels, format)]` or `[]` without data.
- `fetchData` / `columns` / `infoboxKey` unchanged (CSV/XLSX/JSON unchanged — FR-014).
