# UI Contract: Export link and dialog

## `<app-export-control featureId="…" />`

- Inputs: `featureId` (required). The `severity` input is removed (7 call sites updated).
- Renders a text link button: icon + `export.link` ("Daten exportieren" / "Export data"), primary color.
- Disabled (definition `isEnabled()` false): button disabled, tooltip = `disabledTooltipKey`, dialog cannot open.

## `ExportDialogComponent` (internal to shared-ui)

- Inputs: `featureId`; two-way `visible`.
- Content: header (title, hint), optional error banner, four cards in fixed order PDF, Excel, CSV, JSON.
- No "export all" control.

## `FeatureExportRunner.run(featureId, format): Promise<string>`

- Executes the existing export pipeline unchanged (fetch → resolve → `exportFeature` → download) and resolves with the downloaded file name. Rejects on failure.

## `libs/export` additions

```ts
exportFileExtensionFor(format: ExportFormat, hasTables: boolean): string  // 'zip' for csv+tables, else format
sanitizeExportFileName(title: string): string
exportFileName(title: string, format: ExportFormat, hasTables: boolean): string
```

`exportFileExtension(resolved, format)` keeps its signature and delegates.

## Test ids

| Element                      | `data-testid`              |
| ---------------------------- | -------------------------- |
| Open link (enabled/disabled) | `export-open-link`         |
| Dialog                       | `export-dialog`            |
| Dialog close button          | `export-dialog-close`      |
| Error banner                 | `export-dialog-error`      |
| Card                         | `export-card-<format>`     |
| Card export button           | `export-btn-<format>`      |
| Card file name               | `export-filename-<format>` |

## i18n keys (de + en)

`export.link`, `export.dialog.title`, `export.dialog.hint`, `export.dialog.close`, `export.dialog.error` (with format name), `export.dialog.preview`, and per format `export.dialog.<f>.{name,intro,type,data,goodFor,lessSuited,button}` plus `export.dialog.csv.typeZip`; labels `export.dialog.label.{file,type,data,goodFor,lessSuited}`; Earnings: `earnings.export.data.{pdf,xlsx,csv,json}`.
