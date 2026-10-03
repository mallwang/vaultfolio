/**
 * Public contract for `libs/export` — see specs/029-export-data/contracts/export-lib.md and
 * data-model.md for the full field-level documentation.
 *
 * This module MUST stay framework-independent (no Angular/DOM/TranslateService import) per the
 * constitution's Library-First principle.
 */

/** One row in the allocation table shown beside the chart image in the PDF. */
interface ChartSideTableRow {
  label: string;
  value: number;
  percentage: number;
  /** Hex color string for the small color indicator cell (e.g. '#3b82f6'). */
  color?: string;
}

/** Optional distribution/allocation table rendered to the right of the first chart image. */
interface ChartSideTable {
  sectionTitle: string;
  rows: ChartSideTableRow[];
}

/** An `EChartsOption` object, as computed by the feature's own on-screen chart component. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ECharts option shape is owned by the `echarts` package, not this library.
export type EChartsOption = Record<string, any>;

/** How a `PdfTableColumn` value is rendered; amounts are formatted with the export locale. */
export type PdfColumnFormat = 'text' | 'currency' | 'currencyWhole' | 'percent' | 'integer';

export interface PdfTableColumn {
  key: string;
  /** Already translated. */
  label: string;
  format: PdfColumnFormat;
  /** Fixed width in points, `'auto'` or `'*'`; defaults to `'*'` for numeric, `'auto'` for text. */
  width?: number | 'auto' | '*';
  align?: 'left' | 'right';
}

export interface PdfTableRow {
  /** Decimals are canonical strings, formatted at render time. Ratios (`percent`) are fractions. */
  cells: Record<string, string | number | null>;
  /** `'total'` renders the row bold (e.g. a career-total row). */
  emphasis?: 'total';
}

/** One block of a section-based PDF (rendered after title, infobox and charts). */
export type PdfSection =
  | {
      kind: 'table';
      title: string;
      subtitle?: string;
      columns: PdfTableColumn[];
      rows: PdfTableRow[];
      /** Density hint in points; the renderer defaults to 8. */
      fontSize?: number;
    }
  | { kind: 'text'; title?: string; text: string };

export type ExportFormat = 'json' | 'csv' | 'xlsx' | 'pdf';

export type ExportColumnFormat = 'text' | 'number' | 'decimal' | 'date' | 'currency';

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
  /** When true, the PDF exporter appends a bold sum row for this column. Omit to skip summation. */
  summable?: boolean;
}

/** One row per record. Decimal-typed values are canonical decimal strings, never native floats. */
export type ExportRow = Record<string, string | number | null>;

/**
 * The contract a domain library registers with the shared `FeatureExportRegistry`. One instance
 * per feature (Holdings, Account Overview, Retirement, Insurances, Budget Planner, Historic
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
  /**
   * Optional allocation/distribution table shown to the right of the first chart image in the PDF.
   * Called after `fetchData()` (same contract as `getChartOptions`).
   */
  getChartSideTable?(): ChartSideTable | undefined;
  /**
   * Optional PDF-only replacement for the generic table: when present, the PDF shows these
   * sections instead of the `fetchData()` table. Awaited before `getChartOptions()`, so the
   * definition may cache what the charts need. Other formats ignore it.
   */
  getPdfSections?(): Promise<PdfSection[]>;
  /** PDF-only infobox key, used instead of `infoboxKey` for the PDF. */
  pdfInfoboxKey?: string;
  /**
   * Returns `false` to disable the export button. Omit (or return `true`) when always available.
   * May read Angular signals — the component calls this inside `computed()`.
   */
  isEnabled?(): boolean;
  /** Translation key for the disabled-state tooltip (shown when `isEnabled()` returns false). */
  disabledTooltipKey?: string;
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
  columns: { key: string; label: string; format: ExportColumnFormat; summable?: boolean }[];
  rows: ExportRow[];
  /** Pre-captured PNG data URLs, PDF only. */
  chartImages?: string[];
  /** Sections rendered instead of the generic table, PDF only. */
  pdfSections?: PdfSection[];
  /** Allocation table rendered to the right of the first chart image, PDF only. */
  chartSideTable?: ChartSideTable;
  /** BCP 47 language tag (e.g. 'de', 'en') for locale-aware number/date formatting in PDF. */
  locale?: string;
  /** Translated subtitle line shown below the title (e.g. "exportiert am 09.09.2026"). */
  subtitle?: string;
  /** Translated footer line shown at the bottom of PDF exports. */
  footer?: string;
}
