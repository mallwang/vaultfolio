/**
 * Public contract for `libs/export` — see specs/029-export-data/contracts/export-lib.md and
 * data-model.md for the full field-level documentation.
 *
 * This module MUST stay framework-independent (no Angular/DOM/TranslateService import) per the
 * constitution's Library-First principle.
 */

/** An `EChartsOption` object, as computed by the feature's own on-screen chart component. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ECharts option shape is owned by the `echarts` package, not this library.
export type EChartsOption = Record<string, any>;

export type ExportFormat = 'json' | 'csv' | 'xlsx' | 'pdf';

export type ExportColumnFormat = 'text' | 'number' | 'decimal' | 'date';

export interface ExportColumn {
  /** Property name read off each `ExportRow`. */
  key: string;
  /** Translation key resolving to the human-readable column header/label (FR-006). */
  labelKey: string;
  /**
   * Drives CSV/XLSX cell typing and PDF table rendering. `'decimal'` values MUST be carried as
   * their canonical decimal string (never a native float) until the final serialization step.
   */
  format: ExportColumnFormat;
}

/** One row per record. Decimal-typed values are canonical decimal strings, never native floats. */
export type ExportRow = Record<string, string | number | null>;

/**
 * The contract a domain library registers with the shared `FeatureExportRegistry`. One instance
 * per feature (Holdings, Account Overview, Retirement, Insurances, Haushaltsplaner, Historic
 * Wealth Development).
 */
export interface FeatureExportDefinition {
  /** Fixed ASCII slug, e.g. 'holdings'. Used for filenames and archive subdirectory names. */
  featureId: string;
  /** Translation key resolving to the feature's display name (PDF title, archive folder label). */
  titleKey: string;
  /** Translation key resolving to the PDF infobox body text (FR-005). */
  infoboxKey: string;
  /** Every field visible in the feature's on-screen table/detail view (FR-007, SC-002). */
  columns: ExportColumn[];
  /** Resolves to the current user's full dataset; `[]` for a feature with no data yet (FR-014). */
  fetchData(): Promise<ExportRow[]>;
  /** One `EChartsOption` per chart to render for the PDF (FR-004); omitted for chartless features. */
  getChartOptions?(): EChartsOption[];
}

/**
 * A `FeatureExportDefinition` whose `titleKey`/`infoboxKey`/column `labelKey`s have already been
 * resolved to display strings by the caller (the Angular export-control component), so that
 * `libs/export` never depends on `TranslateService` itself. See contracts/export-lib.md's
 * "Language resolution" section.
 */
export interface ResolvedFeatureExport {
  featureId: string;
  title: string;
  infobox: string;
  columns: { key: string; label: string; format: ExportColumnFormat }[];
  rows: ExportRow[];
  /** Pre-captured PNG data URLs, PDF only. */
  chartImages?: string[];
}
