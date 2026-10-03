# Contract: format-neutral export tables (Phase 2)

Extends `specs/029-export-data/contracts/export-lib.md` and `export-pdf-sections.md`. Version impact: `libs/export` MINOR (additive optional fields). For consumers of the earnings export the content of JSON/CSV/Excel changes (breaking for the former per-payslip files).

## Types (`@vaultfolio/export`)

```ts
export type ExportTableColumnFormat = 'text' | 'integer' | 'money' | 'ratio';

export interface ExportTableColumn {
  key: string; // stable, language-independent (JSON field name)
  label: string; // already translated (CSV/Excel header)
  format: ExportTableColumnFormat;
}

export interface ExportTableRow {
  cells: Record<string, string | number | null>; // money/ratio: canonical decimal strings, ratio = fraction
  emphasis?: 'total';
}

export interface ExportTable {
  id: string; // stable, language-independent (JSON section key)
  title: string; // already translated (sheet name, CSV file name)
  columns: ExportTableColumn[];
  rows: ExportTableRow[];
  totalKey?: string; // JSON key that receives the `emphasis: 'total'` row
}

// FeatureExportDefinition (addition)
getExportTables?(): Promise<ExportTable[]>;

// ResolvedFeatureExport (addition)
tables?: ExportTable[];

// export-feature.ts (addition)
export function exportFileExtension(resolved: ResolvedFeatureExport, format: ExportFormat): string;
// 'zip' for format 'csv' when resolved.tables is set, otherwise the format itself
```

## Behaviour

1. `ExportControlComponent`, for `format !== 'pdf'`: if `getExportTables` exists, awaits it, does **not** call `fetchData()` (rows = `[]`), sets `resolved.tables`. For `pdf` nothing changes (sections as in Phase 1). Download name = `<title>.<exportFileExtension(resolved, format)>`.
2. `exportJson` / `exportXlsx` / `exportCsv` with `tables` set serialize the tables as below; without `tables` the existing generic output is byte-for-byte unchanged (regression test per exporter). `exportPdf` ignores `tables`.
3. `exportAll`: for a definition with `getExportTables` the tables are resolved once and used for JSON, XLSX and CSV; CSV files are written flat into `<featureId>/`; the PDF uses `getPdfSections` and chart as the single export does. A failing resolve records all formats of that feature as failures (existing rule, FR-015 of 029).
4. No locale-dependent number formatting in CSV/JSON. Decimal strings reach a native number only in the Excel cell.

## Excel (`.xlsx`)

- One worksheet per table in array order; name = title without `[]:*?/\`, max 31 chars, unique.
- Header row bold and frozen; `emphasis: 'total'` row bold; header + data rows auto-filtered.
- `money` → number, `#,##0.00 "€"`; `ratio` → number, `0.0%`; `integer` → number, `0`; `text` → string; `null` → empty.
- Zero rows → header-only sheet.

## CSV (`.zip`)

- Archive `<title>.zip` with `NN-<slug>.csv` per table (`NN` two digits in array order; slug = ASCII-folded lower-case hyphenated title).
- Each file: UTF-8 with BOM, RFC 4180 quoting, CRLF, comma separator, first line translated labels; `money`/`ratio` verbatim canonical strings, `null` → empty field; total row last.
- Zero rows → header-only file.

## JSON (`.json`)

```json
{
  "grossPerYear": [
    {
      "year": 2026,
      "monthsEmployed": 9,
      "gross": "61234.50",
      "regular": "…",
      "bonus": "…",
      "net": "…",
      "taxes": "…",
      "social": "…",
      "taxRatio": "0.2113",
      "socialRatio": "0.1988"
    }
  ],
  "employers": [
    {
      "employer": "ACME GmbH",
      "gross": "…",
      "net": "…",
      "netRatio": "0.6123",
      "taxes": "…",
      "social": "…",
      "bonus": "…"
    }
  ],
  "careerTotal": {
    "employer": "…",
    "gross": "…",
    "net": "…",
    "netRatio": "…",
    "taxes": "…",
    "social": "…",
    "bonus": "…"
  },
  "monthlyOverview": [
    {
      "year": 2026,
      "gross01": "5100.00",
      "…": null,
      "gross12": null,
      "grossTotal": "…",
      "net01": "…",
      "netTotal": "…"
    }
  ],
  "taxesPerYear": [
    {
      "year": 2026,
      "employer": "ACME GmbH",
      "months": 9,
      "gross": "…",
      "bonus": "…",
      "taxGross": "…",
      "wageTax": "…",
      "soli": "…",
      "churchTax": "…",
      "health": "…",
      "care": "…",
      "pension": "…",
      "unemployment": "…",
      "taxRatio": "…",
      "socialRatio": "…"
    }
  ]
}
```

- Keys and field names are identical in every UI language; the `careerTotal.employer` value is the translated label of the total row.
- Section order = PDF order; `careerTotal` directly follows `employers`; `null` when there is no data. Missing months are `null`.
- Amounts are strings; counts (`monthsEmployed`, `months`, `year`) are numbers. New keys may be added later without breaking consumers.

## Earnings usage (`createEarningsExportDefinition`)

- `getExportTables()`: `overview()` + `tables()` (no employer filter) → `buildEarningsReport` → `toExportTables(report, t)`; 403 → the four tables with zero rows; 503 propagates.
- `getPdfSections()` is rebuilt on the same report (output unchanged from Phase 1).
- `fetchData`/`columns` remain only as empty placeholders; the per-payslip rows are gone from every format.
