# Data Model: Earnings Export Rework

No persistence changes. Everything below is an in-memory, per-export view model derived from existing API read models (`EarningsOverview`, `EarningsTables`).

## PdfSection (new, `libs/export`)

Discriminated union, additive to `ResolvedFeatureExport`:

- `kind: 'table'` — `title`, optional `subtitle`, `columns: PdfTableColumn[]`, `rows: PdfTableRow[]`, optional `emphasizeLastColumn` (career total), optional `densityPt` (font size hint), `splitColumns?: boolean` (allow splitting into column blocks that repeat the first column, see research §3).
- `kind: 'text'` — `title?`, `text` (used for empty states).

`PdfTableColumn`: `key`, `label`, `format: 'text' | 'currency' | 'currencyWhole' | 'percent' | 'integer'`, `width?: number | 'auto' | '*'`, `align?: 'left' | 'right'`.

`PdfTableRow`: `{ cells: Record<key, string | number | null>; emphasis?: 'total' }` — amounts as canonical decimal strings, formatted at render time with `resolved.locale`.

## Earnings PDF sections (derived)

| Section                        | Source                              | Rows                                                                                               | Columns                                                                                                                           | Order                                      |
| ------------------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Employer overview              | `overview.career`                   | key figures: period (first–last), months employed, gross, bonus, taxes, social, net, Ø gross/month | label + one per employer + `ALL` ("Career total")                                                                                 | employers by `lastPeriod` desc, `ALL` last |
| Monthly overview               | `tables.monthGrid` (metric `gross`) | one per year                                                                                       | year, Jan…Dec (whole €), sum                                                                                                      | years desc                                 |
| Taxes & contributions per year | `tables.taxesPerYear`               | one per year × employer                                                                            | year, employer, months, gross, bonus, tax gross, wage tax, soli, church tax, health, care, pension, unemployment, tax %, social % | year desc, employer order as above         |

Relationships/validation rules:

- Career-total cell of every summable row (gross, bonus, taxes, social, net, months) equals the sum of the employer cells (integer-cent arithmetic) — asserted in tests; it is taken from `CareerEntry` `ALL` and cross-checked.
- Ø gross/month is shown as returned (`perMonth.gross`), never recomputed from rounded values.
- Grid year sum = sum of its months in integer cents (reuses the on-screen `gridRows` logic).
- Missing months/bonus markers of the screen grid are rendered as `–` / omitted; they carry no data.

## ResolvedFeatureExport / FeatureExportDefinition (changed, additive)

- `ResolvedFeatureExport.pdfSections?: PdfSection[]` — PDF only.
- `FeatureExportDefinition.getPdfSections?(): Promise<PdfSection[]>`, `pdfInfoboxKey?: string`.
- Absence of both → exact current behaviour (generic table).
