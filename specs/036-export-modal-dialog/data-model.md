# Data Model: Export Modal Dialog

No persisted data. UI-level types only.

## `FeatureExportDefinition` (libs/export, extended)

| Field             | Type                                    | Notes                                                                           |
| ----------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| `formatDataKeys?` | `Partial<Record<ExportFormat, string>>` | NEW, optional. i18n key replacing the generic "included data" text of a format. |

All other fields unchanged.

## Export format catalog entry (shared-ui, static)

| Field                                                                      | Notes                                                                  |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `format`                                                                   | `'pdf' \| 'xlsx' \| 'csv' \| 'json'`, display order fixed              |
| `icon`                                                                     | existing icon name (`file-pdf`, `file-excel`, `file-csv`, `file-json`) |
| `nameKey`, `introKey`, `typeKey`, `dataKey`, `goodForKey`, `lessSuitedKey` | `export.dialog.<format>.*` keys                                        |

## Export format card view-model (computed in the dialog)

| Field      | Derivation                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------- |
| `fileName` | `exportFileName(translate(definition.titleKey), format, Boolean(definition.getExportTables))` |
| `typeText` | `export.dialog.<format>.type`; for `csv` with tables `export.dialog.csv.typeZip`              |
| `dataText` | `definition.formatDataKeys?.[format] ?? export.dialog.<format>.data`                          |
| `busy`     | `format ∈ busyFormats()`                                                                      |

## Dialog state

| Signal            | Meaning                                                       |
| ----------------- | ------------------------------------------------------------- |
| `visible` (model) | dialog open/closed, owned by the control                      |
| `busyFormats`     | set of formats currently exporting                            |
| `errorFormat`     | last failed format or `null`; cleared on next export / reopen |
