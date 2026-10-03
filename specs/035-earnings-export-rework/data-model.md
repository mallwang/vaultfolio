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
