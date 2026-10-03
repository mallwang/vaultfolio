import { exportCsv, exportCsvTables } from './csv-exporter.js';
import { exportFileExtensionFor } from './export-file-name.js';
import type { ExportFormat, ResolvedFeatureExport } from './feature-export-definition.js';
import { exportJson } from './json-exporter.js';
import { exportPdf } from './pdf-exporter.js';
import { exportXlsx } from './xlsx-exporter.js';

/**
 * Dispatches a single-feature export to the exporter for `format`. See
 * contracts/export-lib.md — the caller (the Angular export-control component) has already
 * resolved every translation key and captured any chart images into `resolved` before calling
 * this, so `libs/export` stays free of any Angular/DOM/`TranslateService` dependency.
 *
 * `format: 'json' | 'csv' | 'xlsx'` ignore `resolved.chartImages`; `pdf` ignores `resolved.tables`.
 */
export async function exportFeature(
  resolved: ResolvedFeatureExport,
  format: ExportFormat,
): Promise<Blob> {
  switch (format) {
    case 'json':
      return exportJson(resolved);
    case 'csv':
      return resolved.tables ? exportCsvTables(resolved.tables) : exportCsv(resolved);
    case 'xlsx':
      return exportXlsx(resolved);
    case 'pdf':
      return exportPdf(resolved);
  }
}

/** File extension of the download: a CSV export of tables is a ZIP with one file per table. */
export function exportFileExtension(resolved: ResolvedFeatureExport, format: ExportFormat): string {
  return exportFileExtensionFor(format, Boolean(resolved.tables));
}
