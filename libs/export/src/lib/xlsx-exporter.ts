import type {
  ExportColumnFormat,
  ExportTable,
  ExportTableColumn,
  ResolvedFeatureExport,
} from './feature-export-definition.js';

function toCellValue(value: string | number | null, format: ExportColumnFormat) {
  if (value === null) {
    return null;
  }
  switch (format) {
    case 'number':
    case 'decimal':
    case 'currency':
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
    return '#,##0.00';
  }
  if (format === 'currency') {
    return '€#,##0.00';
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
  if (resolved.tables) {
    addTableSheets(workbook, resolved.tables);
    return toBlob(workbook);
  }
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

  return toBlob(workbook);
}

async function toBlob(workbook: { xlsx: { writeBuffer(): Promise<unknown> } }): Promise<Blob> {
  const buffer = (await workbook.xlsx.writeBuffer()) as BlobPart;
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

const TABLE_NUM_FMT = { money: '#,##0.00 "€"', ratio: '0.0%', integer: '0' } as const;

function tableCellValue(value: string | number | null, column: ExportTableColumn) {
  if (value === null) return null;
  // Decimal strings become native numbers only here, at final serialization (Principle III).
  return column.format === 'text' ? String(value) : Number(value);
}

/** Sheet names: no `[]:*?/\`, at most 31 characters, unique within the workbook. */
function sheetName(title: string, used: Set<string>): string {
  const base =
    title
      .replace(/[[\]:*?/\\]/g, '')
      .trim()
      .slice(0, 31) || 'Sheet';
  let name = base;
  let counter = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` ${counter++}`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name.toLowerCase());
  return name;
}

function addTableSheets(
  workbook: InstanceType<typeof import('exceljs').Workbook>,
  tables: ExportTable[],
) {
  const used = new Set<string>();
  for (const table of tables) {
    const sheet = workbook.addWorksheet(sheetName(table.title, used), {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = table.columns.map((column) => {
      const numFmt = column.format === 'text' ? undefined : TABLE_NUM_FMT[column.format];
      const longest = table.rows.reduce(
        (max, row) => Math.max(max, String(row.cells[column.key] ?? '').length),
        column.label.length,
      );
      return {
        header: column.label,
        key: column.key,
        width: Math.min(Math.max(longest + 2, 10), 40),
        style: numFmt ? { numFmt } : undefined,
      };
    });
    sheet.getRow(1).font = { bold: true };
    for (const row of table.rows) {
      const record: Record<string, unknown> = {};
      for (const column of table.columns) {
        record[column.key] = tableCellValue(row.cells[column.key] ?? null, column);
      }
      const added = sheet.addRow(record);
      if (row.emphasis === 'total') added.font = { bold: true };
    }
    // The filter covers the header and the data rows, not a closing total row.
    const dataRows = table.rows.filter((row) => row.emphasis !== 'total').length;
    if (dataRows > 0 && table.columns.length > 0) {
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1 + dataRows, column: table.columns.length },
      };
    }
  }
}
