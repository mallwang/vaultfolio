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
  /**
   * Key of a second value shown below the main one in the same cell, in smaller grey text and the
   * same format (e.g. net below gross).
   */
  secondaryKey?: string;
  /** Footnote number shown as a superscript after the label; the text is in the table's `footnotes`. */
  footnote?: number;
  /** Renders a missing value as an empty cell instead of a dash. */
  blankWhenMissing?: boolean;
  /** Colors positive values teal and negative ones orange (changes, deltas). */
  signColor?: boolean;
}

export interface PdfTableRow {
  /** Decimals are canonical strings, formatted at render time. Ratios (`percent`) are fractions. */
  cells: Record<string, string | number | null>;
  /** `'total'` renders the row bold (e.g. a career-total row). */
  emphasis?: 'total';
  /** PDF only: bold just these cells instead of the whole row when `emphasis` is set. */
  boldKeys?: string[];
  /** PDF only: cells whose text is indented, marking sub-positions. */
  indentKeys?: string[];
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
      /**
       * `false` lets the table follow the previous content on the same page (it still moves to
       * the next page if it does not fit). Defaults to `true`: every table starts a new page.
       */
      startOnNewPage?: boolean;
      /**
       * Groups of adjacent column keys (each with a numeric `width`). Runs of rows that are blank
       * in every column of a group are merged into one cell with a diagonal line (Buchhalternase).
       */
      blankDiagonals?: string[][];
      /** Already translated; entry `n` (1-based) belongs to the column with `footnote: n`, printed below the table. */
      footnotes?: string[];
    }
  | {
      kind: 'text';
      title?: string;
      text: string;
      /** Orange text, for a notice. */ tone?: 'warning';
    }
  | {
      kind: 'kpis';
      tiles: PdfKpiTile[];
      /** Renders the tiles above the chart instead of after it. */
      beforeChart?: boolean;
    }
  | { kind: 'bar'; title: string; caption?: string; segments: PdfBarSegment[] };

/** One figure tile of a `kpis` section; tiles share the page width evenly. */
export interface PdfKpiTile {
  /** Already translated. */
  label: string;
  /** Preformatted display value. */
  value: string;
  /** Small grey line(s) below the value. */
  hints?: string[];
  /** Accent border and larger value for the headline figure. */
  highlight?: boolean;
  /** Italic value, for projections. */
  italic?: boolean;
  /** Colors the value and hints teal (`positive`) or orange (`negative`). */
  tone?: 'positive' | 'negative';
  /** Orange border only; value and hints keep their normal colors. */
  warnBorder?: boolean;
}

/** One segment of a `bar` section; shares are fractions and are scaled to the bar's width. */
export interface PdfBarSegment {
  /** Already translated; shown in the legend. */
  label: string;
  share: number;
  /** Hex color. */
  color: string;
}

export type ExportTableColumnFormat = 'text' | 'integer' | 'money' | 'ratio' | 'date';

export interface ExportTableColumn {
  /** Stable, language-independent key (JSON field name). */
  key: string;
  /** Already translated (CSV/Excel header). */
  label: string;
  format: ExportTableColumnFormat;
  /**
   * Excel only: formula written instead of the value in every row of the column, as a template
   * whose `{key}` placeholders refer to the cell of that column in the same row, e.g.
   * `IF({gross}=0,0,{taxes}/{gross})`. `{prev:key}` refers to the cell of that column in the row
   * above; a template using it is not written in the first data row. The row's value is kept as the cached result, so viewers
   * that do not recalculate still show it. CSV and JSON ignore this and carry the value.
   */
  formula?: string;
  /** Excel only: a row with `emphasis: 'total'` sums the column's data rows with `SUM(…)`. */
  sumInTotal?: boolean;
  /** Excel only: presentation that differs from the flat CSV/JSON column. */
  excel?: {
    /** Merged header cell above all adjacent columns with the same group; `label` goes below. */
    group?: string;
    /** Header text of the column; defaults to the column's `label`. */
    label?: string;
    /** Leaves the column out of the sheet. */
    hidden?: boolean;
  };
}

export interface ExportTableRow {
  /**
   * `money`/`ratio` are canonical decimal strings (ratio = fraction), `integer` a number, `date` an
   * ISO `YYYY-MM-DD` string (a real date cell with a German format in Excel, verbatim elsewhere).
   */
  cells: Record<string, string | number | null>;
  emphasis?: 'total';
}

/** Format-neutral table: Excel sheet, CSV file or JSON section, depending on the exporter. */
export interface ExportTable {
  /** Stable, language-independent key (JSON section name). */
  id: string;
  /** Already translated (sheet name, CSV file name). */
  title: string;
  columns: ExportTableColumn[];
  rows: ExportTableRow[];
  /** JSON key that receives the `emphasis: 'total'` row. */
  totalKey?: string;
  /** Already translated; Excel and CSV write it as the only data row of a table without rows (JSON stays `[]`). */
  emptyText?: string;
}

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
  /**
   * Optional replacement of `fetchData()`/`columns` for JSON, CSV and Excel: when present, those
   * formats serialize these tables instead of the generic rows. The PDF ignores it.
   */
  getExportTables?(): Promise<ExportTable[]>;
  /** Page orientation of the PDF; defaults to landscape. */
  pdfOrientation?: 'portrait' | 'landscape';
  /** PDF-only infobox key, used instead of `infoboxKey` for the PDF. */
  pdfInfoboxKey?: string;
  /**
   * Capture size in CSS pixels of the PDF chart images. In a section PDF the first chart is drawn
   * at the full page width, so a wide size (e.g. 1000×330) avoids a stretched or tiny chart.
   */
  pdfChartSize?: { width: number; height: number };
  /**
   * Returns `false` to disable the export button. Omit (or return `true`) when always available.
   * May read Angular signals — the component calls this inside `computed()`.
   */
  isEnabled?(): boolean;
  /**
   * Optional per-format translation keys that replace the generic "included data" text of a
   * format card in the export dialog (e.g. Earnings' CSV is a ZIP of four files).
   */
  formatDataKeys?: Partial<Record<ExportFormat, string>>;
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
  /** Tables serialized instead of `rows`, JSON/CSV/Excel only. */
  tables?: ExportTable[];
  /** Allocation table rendered to the right of the first chart image, PDF only. */
  chartSideTable?: ChartSideTable;
  /** PNG data URL of the app logo, shown top right next to the title; PDF only. */
  logo?: string;
  /** PDF page orientation; defaults to landscape. */
  orientation?: 'portrait' | 'landscape';
  /** BCP 47 language tag (e.g. 'de', 'en') for locale-aware number/date formatting in PDF. */
  locale?: string;
  /** Translated subtitle line shown below the title (e.g. "exportiert am 09.09.2026"). */
  subtitle?: string;
  /** Translated footer line shown at the bottom of PDF exports. */
  footer?: string;
}
