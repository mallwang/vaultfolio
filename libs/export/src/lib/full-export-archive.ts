import type JSZip from 'jszip';
import { exportTableCsvFiles } from './csv-exporter.js';
import { exportFeature } from './export-feature.js';
import type {
  ExportColumnFormat,
  ExportFormat,
  FeatureExportDefinition,
  ResolvedFeatureExport,
} from './feature-export-definition.js';
import type { FeatureExportRegistry } from './feature-export-registry.js';

export interface FullExportResult {
  /** `vaultfolio-data-export.zip` bytes. */
  archive: Blob;
  /** Per FR-015: one entry per feature/format combination whose generation threw. */
  failures: { featureId: string; format: ExportFormat }[];
}

const ALL_FORMATS: ExportFormat[] = ['json', 'csv', 'xlsx', 'pdf'];

/**
 * Resolves a `FeatureExportDefinition`'s translation keys to display strings for one archive
 * entry. See contracts/export-lib.md's "Language resolution" — `libs/export` never resolves
 * translation keys itself; the caller (the Angular "Export my data" flow) supplies this callback
 * the same way the export-control component resolves labels for a single-feature export.
 */
export type ResolveLabels = (definition: FeatureExportDefinition) => {
  title: string;
  infobox: string;
  columns: { key: string; label: string; format: ExportColumnFormat }[];
  /** Infobox of the PDF, when it differs from `infobox`. */
  pdfInfobox?: string;
  /** Locale and texts the PDF needs when the feature renders sections. */
  locale?: string;
  subtitle?: string;
  footer?: string;
};

interface ResolvedEntry {
  /** JSON, CSV and Excel input. */
  resolved: ResolvedFeatureExport;
  /** PDF input: the sections (if any), chart images and PDF infobox. */
  pdfResolved: ResolvedFeatureExport;
}

/** Resolves one feature's data, tables, sections, labels and chart images. Throws on any failure. */
async function resolveEntry(
  definition: FeatureExportDefinition,
  resolveLabels: ResolveLabels,
  resolveChartImages: (definition: FeatureExportDefinition) => Promise<string[]>,
): Promise<ResolvedEntry> {
  // A definition with tables / PDF sections replaces `fetchData()` for those formats.
  const tables = definition.getExportTables ? await definition.getExportTables() : undefined;
  const pdfSections = definition.getPdfSections ? await definition.getPdfSections() : undefined;
  const rows = tables && pdfSections ? [] : await definition.fetchData();
  const labels = resolveLabels(definition);
  const chartImages = definition.getChartOptions ? await resolveChartImages(definition) : undefined;
  const resolved: ResolvedFeatureExport = {
    featureId: definition.featureId,
    title: labels.title,
    infobox: labels.infobox,
    columns: labels.columns,
    rows: tables ? [] : rows,
    ...(tables ? { tables } : {}),
    ...(labels.locale ? { locale: labels.locale } : {}),
    ...(labels.subtitle ? { subtitle: labels.subtitle } : {}),
    ...(labels.footer ? { footer: labels.footer } : {}),
  };
  const pdfResolved: ResolvedFeatureExport = {
    ...resolved,
    infobox: labels.pdfInfobox ?? labels.infobox,
    rows: pdfSections ? [] : rows,
    tables: undefined,
    ...(pdfSections ? { pdfSections } : {}),
    chartImages,
  };
  return { resolved, pdfResolved };
}

/** Writes one format of one feature into its archive folder. */
async function writeFormat(
  folder: JSZip | null,
  featureId: string,
  format: ExportFormat,
  { resolved, pdfResolved }: ResolvedEntry,
): Promise<void> {
  if (format === 'csv' && resolved.tables) {
    // The table files go flat into the feature folder, no ZIP inside the ZIP.
    for (const file of exportTableCsvFiles(resolved.tables)) {
      folder?.file(file.name, file.content);
    }
    return;
  }
  const blob = await exportFeature(format === 'pdf' ? pdfResolved : resolved, format);
  folder?.file(`${featureId}.${format}`, await blob.arrayBuffer());
}

/**
 * Builds the full "Export my data" archive: iterates every registered `FeatureExportDefinition`,
 * fetches its data, and writes `<featureId>/<featureId>.<ext>` for each of the 4 formats. A
 * single format's failure for a single feature is caught and recorded in `failures` without
 * stopping the rest of the archive (FR-015) — see data-model.md's "Export Archive (full export)".
 *
 * Deferred `import('jszip')`: only the (rarely used) full-export path needs a ZIP library — every
 * consumer of this library's public barrel must not pull it into an eagerly-loaded bundle just by
 * importing `exportFeature`, matches `xlsx-exporter.ts`/`pdf-exporter.ts`'s identical treatment.
 */
export async function exportAll(
  registry: FeatureExportRegistry,
  resolveLabels: ResolveLabels,
  resolveChartImages: (definition: FeatureExportDefinition) => Promise<string[]>,
): Promise<FullExportResult> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const failures: { featureId: string; format: ExportFormat }[] = [];

  for (const definition of registry.getAll()) {
    const { featureId } = definition;
    let entry: ResolvedEntry;
    try {
      entry = await resolveEntry(definition, resolveLabels, resolveChartImages);
    } catch {
      // Fetching this feature's data (or its chart images) failed — every format for this
      // feature is unproducible, so record all 4 as failures (FR-015) and move on to the next
      // feature rather than aborting the whole archive.
      failures.push(...ALL_FORMATS.map((format) => ({ featureId, format })));
      continue;
    }

    const folder = zip.folder(featureId);
    for (const format of ALL_FORMATS) {
      try {
        await writeFormat(folder, featureId, format, entry);
      } catch {
        failures.push({ featureId, format });
      }
    }
  }

  const archive = await zip.generateAsync({ type: 'blob' });
  return { archive, failures };
}
