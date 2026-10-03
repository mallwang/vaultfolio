# Data Model: Earnings Export Rework

No persistence changes. Everything below is an in-memory, per-export view model derived from existing API read models (`EarningsOverview`, `EarningsTables`).

## PdfSection (new, `libs/export`)

Discriminated union, additive to `ResolvedFeatureExport`:

- `kind: 'table'` — `title`, optional `subtitle`, `columns: PdfTableColumn[]`, `rows: PdfTableRow[]`, optional `fontSize` (density hint). Rows may carry `emphasis: 'total'` (career total row).
- `kind: 'text'` — `title?`, `text` (used for empty states).

`PdfTableColumn`: `key`, `label`, `format: 'text' | 'currency' | 'currencyWhole' | 'percent' | 'integer'`, `width?: number | 'auto' | '*'`, `align?: 'left' | 'right'`.

`PdfTableRow`: `{ cells: Record<key, string | number | null>; emphasis?: 'total' }` — amounts as canonical decimal strings, formatted at render time with `resolved.locale`.

## Earnings PDF sections (derived)

| Section                        | Source                              | Rows                                                            | Columns                                                                                                                           | Order                                      |
| ------------------------------ | ----------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Employer overview              | `overview.career`                   | one per employer, plus a final `ALL` total row ("Career total") | employer, gross, net, net ratio, taxes, social, bonus                                                                             | employers by `lastPeriod` desc, `ALL` last |
| Monthly overview               | `tables.monthGrid` (metric `gross`) | one per year                                                    | year, Jan…Dec (whole €), sum                                                                                                      | years desc                                 |
| Taxes & contributions per year | `tables.taxesPerYear`               | one per year × employer                                         | year, employer, months, gross, bonus, tax gross, wage tax, soli, church tax, health, care, pension, unemployment, tax %, social % | year desc, employer order as above         |

Relationships/validation rules:

- Career-total row: gross, net, taxes, social and bonus equal the sum of the employer rows (integer-cent arithmetic) — asserted in tests; taken from `CareerEntry` `ALL` and cross-checked. Net ratio is shown as returned by `CareerEntry.netRatio`, never recomputed from rounded values.
- Grid year sum = sum of its months in integer cents (reuses the on-screen `gridRows` logic).
- Missing months/bonus markers of the screen grid are rendered as `–` / omitted; they carry no data.

## ResolvedFeatureExport / FeatureExportDefinition (changed, additive)

- `ResolvedFeatureExport.pdfSections?: PdfSection[]` — PDF only.
- `FeatureExportDefinition.getPdfSections?(): Promise<PdfSection[]>`, `pdfInfoboxKey?: string`.
- Absence of both → exact current behaviour (generic table).

---

# Phase 2 additions (amended 2026-10-03)

Still no persistence changes; all in-memory per export.

## ExportTable (new, `libs/export`) — format-neutral table

- `id: string` — stable, language-independent key (JSON section name), e.g. `employers`.
- `title: string` — translated; Excel sheet name and CSV file name derive from it.
- `columns: ExportTableColumn[]` — `{ key: string /* stable */; label: string /* translated */; format: 'text' | 'integer' | 'money' | 'ratio' }`.
- `rows: ExportTableRow[]` — `{ cells: Record<key, string | number | null>; emphasis?: 'total' }`. `money` and `ratio` are canonical decimal strings (ratios as fractions), `integer` a number, missing = `null`.
- `totalKey?: string` — JSON key for the `emphasis: 'total'` row (`careerTotal`).

`ResolvedFeatureExport.tables?: ExportTable[]` (additive); `FeatureExportDefinition.getExportTables?(): Promise<ExportTable[]>`.

## EarningsReport (new, earnings lib, in-memory)

Result of `buildEarningsReport(overview, tables)`; the only place that sorts, sums and picks the career total:

| Part        | Content                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| `yearly`    | `YearlyPoint[]` newest first                                                                              |
| `employers` | `CareerEntry[]` newest first, `total: CareerEntry \| null` (the `ALL` entry, or the single employer)      |
| `monthGrid` | per year (newest first): 12 gross cells, 12 net cells, gross sum, net sum (integer-cent sums, cents kept) |
| `taxRows`   | `TaxYearRow[]` year desc, then employer recency                                                           |

`earnings-pdf-sections.ts` projects it to `PdfSection[]`; `earnings-export-tables.ts` to `ExportTable[]`.

## Earnings export tables

| `id` (JSON key)               | Rows                             | Columns (stable keys)                                                                                                                                              | Order                             |
| ----------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `grossPerYear`                | one per year                     | `year`, `monthsEmployed`, `gross`, `regular`, `bonus`, `net`, `taxes`, `social`, `taxRatio`, `socialRatio`                                                         | year desc                         |
| `employers` (+ `careerTotal`) | one per employer + closing total | `employer`, `gross`, `net`, `netRatio`, `taxes`, `social`, `bonus`                                                                                                 | employer recency desc, total last |
| `monthlyOverview`             | one per year                     | `year`, `gross01`…`gross12`, `grossTotal`, `net01`…`net12`, `netTotal`                                                                                             | year desc                         |
| `taxesPerYear`                | one per year × employer          | `year`, `employer`, `months`, `gross`, `bonus`, `taxGross`, `wageTax`, `soli`, `churchTax`, `health`, `care`, `pension`, `unemployment`, `taxRatio`, `socialRatio` | year desc, employer recency       |

Validation rules: career total = sum of employer rows (integer cents); `grossTotal`/`netTotal` = exact sum of the year's months; identical figures in `ExportTable` and `PdfSection` projections (parity test); the old per-payslip columns (employer, period, issued, kind, source, corrected …) exist in no table.
