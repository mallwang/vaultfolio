import type { ExportFormat } from './feature-export-definition.js';

/** File extension of the download: a CSV export of tables is a ZIP with one file per table. */
export function exportFileExtensionFor(format: ExportFormat, hasTables: boolean): string {
  return format === 'csv' && hasTables ? 'zip' : format;
}

/** Replaces the characters that are not allowed in file names on common file systems. */
export function sanitizeExportFileName(title: string): string {
  return title.replace(/[/\\:*?"<>|]/g, '_');
}

/** Download file name for a feature export; shared by the download and the export dialog cards. */
export function exportFileName(title: string, format: ExportFormat, hasTables: boolean): string {
  return `${sanitizeExportFileName(title)}.${exportFileExtensionFor(format, hasTables)}`;
}
