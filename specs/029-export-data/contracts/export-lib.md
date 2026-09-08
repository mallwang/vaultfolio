# Contract: `libs/export` public interface

This feature adds no backend HTTP endpoints (see `research.md` §1), so its external interface is
the public TypeScript contract of the new `libs/export` library (consumed by
`libs/frontend/shared-ui`'s export control and by every domain library that registers with it).
This is the interface other code is written against and that must stay backward-compatible per
Principle V's contract-versioning rule.

## Types (see `data-model.md` for full field tables)

```ts
export type ExportFormat = 'json' | 'csv' | 'xlsx' | 'pdf';

export interface ExportColumn {
  key: string;
  labelKey: string; // translation key
  format: 'text' | 'number' | 'decimal' | 'date';
}

export type ExportRow = Record<string, string | number | null>;

export interface FeatureExportDefinition {
  featureId: string; // fixed ASCII slug, e.g. 'holdings'
  titleKey: string;
  infoboxKey: string;
  columns: ExportColumn[];
  fetchData(): Promise<ExportRow[]>;
  getChartOptions?(): EChartsOption[]; // omit for features with no charts
}
```

## Registry

```ts
export interface FeatureExportRegistry {
  register(definition: FeatureExportDefinition): void;
  getAll(): readonly FeatureExportDefinition[];
  getById(featureId: string): FeatureExportDefinition | undefined;
}
```

- `register` is called once per domain library at bootstrap (mirrors the existing Dashboard/
  Settings per-domain contribution pattern already mandated by the constitution).
- Registering the same `featureId` twice MUST throw — a programming error, not a runtime edge case.

## Single-feature export

```ts
function exportFeature(
  definition: FeatureExportDefinition,
  format: ExportFormat,
  chartImages?: string[], // pre-captured PNG data URLs, PDF only — see below
): Promise<Blob>;
```

- Callers resolve `chartImages` themselves (the Angular export-control component owns the
  off-screen ECharts capture seam from `research.md` §3) so `libs/export` itself stays free of any
  Angular/DOM dependency and is testable with mocked image strings.
- `format: 'json'` / `'csv'` / `'xlsx'` ignore `chartImages`.
- Every column in `definition.columns` MUST appear in the output, in order, with its `labelKey`
  resolved by the caller before invocation (the library receives already-resolved label strings —
  see "Language resolution" below) — never raw translation keys leaking into a downloaded file.
- Called with zero rows (`fetchData()` resolved to `[]`), every format MUST still produce a valid,
  correctly structured file: JSON `[]`, CSV header row only, XLSX with header row and column
  formatting only, PDF with the infobox and (if `getChartOptions` is present) chart images but an
  empty data table — this is what makes FR-014 hold for `exportFeature` itself, not just for the
  full archive.

## Language resolution

`libs/export` never resolves translation keys itself (it has no dependency on
`TranslateService`) — the Angular export-control component resolves every `labelKey`/`titleKey`/
`infoboxKey` to the current language's string _before_ calling into `libs/export`, and passes
already-resolved strings through a thin `ResolvedFeatureExport` shape wrapping the definition.
This keeps `libs/export` framework-independent (Principle I) while satisfying FR-006 by
construction — there is exactly one place (the existing `TranslateService`) that ever resolves a
translation key for an export.

## Full export

```ts
interface FullExportResult {
  archive: Blob; // vaultfolio-data-export.zip
  failures: { featureId: string; format: ExportFormat }[]; // FR-015
}

function exportAll(
  registry: FeatureExportRegistry,
  resolveChartImages: (definition: FeatureExportDefinition) => Promise<string[]>,
): Promise<FullExportResult>;
```

- Iterates `registry.getAll()`; for each definition, for each of the 4 formats, calls
  `exportFeature` and adds the result under `<featureId>/<featureId>.<ext>` in the archive.
- A single format's failure for a single feature is caught, recorded in `failures`, and does not
  stop the rest of the archive from being built (FR-015) — the returned `archive` is always
  produced (assuming at least the empty-archive case), never rejected outright by one failure.

## Export control component (`libs/frontend/shared-ui`)

```html
<app-export-control [featureId]="'holdings'" severity="info" />
```

- Looks up its `FeatureExportDefinition` from the app-wide `FeatureExportRegistry` (provided at
  the app-shell level, populated by each domain library's registration) by `featureId`.
- Renders the split-button (default action: open the format menu — no single default format, per
  `design.md`) with the JSON/CSV/XLSX/PDF menu items shown in `mockup.html`.
- On a menu item click: resolves labels via `TranslateService`, captures chart images if
  `getChartOptions` is present (`research.md` §3), calls `exportFeature`, and triggers the browser
  download with the feature-appropriate filename (`<featureId>.<ext>`).
- Carries no per-feature knowledge itself — the same component instance/selector is what FR-009
  requires to be identical across all 6 features.
