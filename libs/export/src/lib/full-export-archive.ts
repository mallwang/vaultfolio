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
};

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
    let resolved: ResolvedFeatureExport;
    try {
      const rows = await definition.fetchData();
      const labels = resolveLabels(definition);
      const chartImages = definition.getChartOptions
        ? await resolveChartImages(definition)
        : undefined;
      resolved = {
        featureId: definition.featureId,
        title: labels.title,
        infobox: labels.infobox,
        columns: labels.columns,
        rows,
        chartImages,
      };
    } catch {
      // Fetching this feature's data (or its chart images) failed — every format for this
      // feature is unproducible, so record all 4 as failures (FR-015) and move on to the next
      // feature rather than aborting the whole archive.
      for (const format of ALL_FORMATS) {
        failures.push({ featureId: definition.featureId, format });
      }
      continue;
    }

    const folder = zip.folder(definition.featureId);
    for (const format of ALL_FORMATS) {
      try {
        const blob = await exportFeature(resolved, format);
        const buffer = await blob.arrayBuffer();
        folder?.file(`${definition.featureId}.${format}`, buffer);
      } catch {
        failures.push({ featureId: definition.featureId, format });
      }
    }
  }

  const archive = await zip.generateAsync({ type: 'blob' });
  return { archive, failures };
}
