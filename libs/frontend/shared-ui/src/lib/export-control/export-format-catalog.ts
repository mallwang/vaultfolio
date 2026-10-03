import type { ExportFormat } from '@vaultfolio/export';

export interface ExportFormatCatalogEntry {
  format: ExportFormat;
  icon: string;
  nameKey: string;
  introKey: string;
  typeKey: string;
  dataKey: string;
  goodForKey: string;
  lessSuitedKey: string;
  buttonKey: string;
}

function entry(format: ExportFormat, icon: string): ExportFormatCatalogEntry {
  const base = `export.dialog.${format}`;
  return {
    format,
    icon,
    nameKey: `${base}.name`,
    introKey: `${base}.intro`,
    typeKey: `${base}.type`,
    dataKey: `${base}.data`,
    goodForKey: `${base}.goodFor`,
    lessSuitedKey: `${base}.lessSuited`,
    buttonKey: `${base}.button`,
  };
}

/** The formats offered by the export dialog, in display order. */
export const EXPORT_FORMAT_CATALOG: readonly ExportFormatCatalogEntry[] = [
  entry('pdf', 'file-pdf'),
  entry('xlsx', 'file-excel'),
  entry('csv', 'file-csv'),
  entry('json', 'file-json'),
];
