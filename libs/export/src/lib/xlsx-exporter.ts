import type { ExportColumnFormat, ResolvedFeatureExport } from './feature-export-definition.js';

function toCellValue(value: string | number | null, format: ExportColumnFormat) {
  if (value === null) {
    return null;
  }
  switch (format) {
    case 'number':
    case 'decimal':
      // Decimal strings are converted to a native numeric cell only here, at final
      // serialization (Principle III) — never earlier in the pipeline.
      return typeof value === 'number' ? value : Number(value);
    case 'date':
      return typeof value === 'string' ? new Date(value) : value;
    case 'text':
    default:
      return String(value);
  }
}

function numFmtFor(format: ExportColumnFormat): string | undefined {
  if (format === 'date') {
    return 'yyyy-mm-dd';
  }
  if (format === 'decimal') {
    return '0.####################';
  }
  return undefined;
}

/**
 * `ResolvedFeatureExport` -> `.xlsx` bytes via `exceljs`, with typed columns
 * (text/number/decimal/date). Called with zero rows, produces a header-only sheet with the
 * column formatting still applied (FR-014).
 *
 * Deferred `import('exceljs')`: `exceljs` is a large dependency, so every consumer of this
 * library's public barrel must not pull it into an eagerly-loaded bundle just by importing
 * `exportFeature`/`exportAll` — matches `pdf-exporter.ts`'s identical treatment of `pdfmake`.
 */
export async function exportXlsx(resolved: ResolvedFeatureExport): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(resolved.title.slice(0, 31) || 'Export');

  sheet.columns = resolved.columns.map((column) => ({
    header: column.label,
    key: column.key,
    style: numFmtFor(column.format) ? { numFmt: numFmtFor(column.format) } : undefined,
  }));

  for (const row of resolved.rows) {
    const record: Record<string, unknown> = {};
    for (const column of resolved.columns) {
      record[column.key] = toCellValue(row[column.key], column.format);
    }
    sheet.addRow(record);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
