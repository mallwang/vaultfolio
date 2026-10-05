import type {
  ExportColumnFormat,
  ExportTable,
  ExportTableColumn,
  ExportTableRow,
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
    addTableSheets(workbook, resolved.tables, resolved.locale);
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

const TABLE_NUM_FMT = {
  money: '#,##0.00 "€"',
  ratio: '0.0%',
  integer: '0',
  date: 'dd.mm.yyyy',
} as const;

/** German day.month.year and trailing euro sign; every other language gets ISO dates and a leading euro sign. */
function numFmtsFor(locale: string | undefined) {
  if (!locale || locale.startsWith('de')) return TABLE_NUM_FMT;
  return { ...TABLE_NUM_FMT, money: '"€"#,##0.00', date: 'yyyy-mm-dd' } as const;
}

function tableCellValue(value: string | number | null, column: ExportTableColumn) {
  if (value === null) return null;
  if (column.format === 'text') return String(value);
  // ISO dates parse as UTC midnight, which Excel stores as the plain calendar day.
  if (column.format === 'date') return new Date(`${value}T00:00:00Z`);
  // Decimal strings become native numbers only here, at final serialization (Principle III).
  return Number(value);
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

function columnLetter(index: number): string {
  let letter = '';
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) {
    letter = String.fromCodePoint(65 + ((n - 1) % 26)) + letter;
  }
  return letter;
}

/** Merges each run of same-group columns in row 1; ungrouped columns span both header rows. */
function mergeHeader(sheet: import('exceljs').Worksheet, columns: ExportTableColumn[]) {
  let start = 0;
  while (start < columns.length) {
    const group = columns[start].excel?.group;
    let end = start;
    while (group && columns[end + 1]?.excel?.group === group) end++;
    if (!group) sheet.mergeCells(1, start + 1, 2, start + 1);
    else if (end > start) sheet.mergeCells(1, start + 1, 1, end + 1);
    start = end + 1;
  }
}

/** Writes the one or two header rows; grouped columns get a merged cell above their labels. */
function addHeader(
  sheet: import('exceljs').Worksheet,
  columns: ExportTableColumn[],
  headerRows: number,
) {
  const labels = columns.map((column) => column.excel?.label ?? column.label);
  if (headerRows === 1) {
    sheet.addRow(labels);
  } else {
    sheet.addRow(
      columns.map((column) => column.excel?.group ?? column.excel?.label ?? column.label),
    );
    sheet.addRow(
      columns.map((column) => (column.excel?.group ? (column.excel.label ?? column.label) : null)),
    );
    mergeHeader(sheet, columns);
  }
  for (let r = 1; r <= headerRows; r++) {
    const row = sheet.getRow(r);
    row.font = { bold: true };
    row.alignment = { horizontal: headerRows === 2 ? 'center' : undefined, vertical: 'middle' };
  }
}

function cellFormula(
  column: ExportTableColumn,
  row: ExportTableRow,
  rowNumber: number,
  letters: Map<string, string>,
  [firstData, lastData]: (number | undefined)[],
): string | undefined {
  if (row.emphasis === 'total' && column.sumInTotal && firstData) {
    const letter = letters.get(column.key);
    return `SUM(${letter}${firstData}:${letter}${lastData})`;
  }
  if (!column.formula) return undefined;
  // `{prev:key}` needs a data row above; the first data row keeps its plain value.
  if (column.formula.includes('{prev:') && (!firstData || rowNumber <= firstData)) return undefined;
  return column.formula.replace(
    /\{(prev:)?(\w+)\}/g,
    (_, prev: string | undefined, key: string) =>
      `${letters.get(key)}${rowNumber - (prev ? 1 : 0)}`,
  );
}

function addTableSheets(
  workbook: InstanceType<typeof import('exceljs').Workbook>,
  tables: ExportTable[],
  locale: string | undefined,
) {
  const numFmts = numFmtsFor(locale);
  const used = new Set<string>();
  for (const table of tables) {
    const columns = table.columns.filter((column) => !column.excel?.hidden);
    const headerRows = columns.some((column) => column.excel?.group) ? 2 : 1;
    const sheet = workbook.addWorksheet(sheetName(table.title, used), {
      views: [{ state: 'frozen', ySplit: headerRows }],
    });
    sheet.columns = columns.map((column) => {
      const numFmt = column.format === 'text' ? undefined : numFmts[column.format];
      const label = column.excel?.label ?? column.label;
      const longest = table.rows.reduce(
        (max, row) => Math.max(max, String(row.cells[column.key] ?? '').length),
        label.length,
      );
      return {
        key: column.key,
        width: Math.min(Math.max(longest + 2, 10), 40),
        style: numFmt ? { numFmt } : undefined,
      };
    });
    addHeader(sheet, columns, headerRows);

    const letters = new Map(columns.map((column, i) => [column.key, columnLetter(i + 1)]));
    const dataRowNumbers = table.rows
      .map((row, i) => (row.emphasis === 'total' ? 0 : headerRows + 1 + i))
      .filter(Boolean);
    const firstData = dataRowNumbers[0];
    const lastData = dataRowNumbers.at(-1);

    table.rows.forEach((row, i) => {
      const rowNumber = headerRows + 1 + i;
      const record: Record<string, unknown> = {};
      for (const column of columns) {
        const value = tableCellValue(row.cells[column.key] ?? null, column);
        const formula = cellFormula(column, row, rowNumber, letters, [firstData, lastData]);
        record[column.key] =
          formula === undefined ? value : { formula, ...(value === null ? {} : { result: value }) };
      }
      const added = sheet.addRow(record);
      if (row.emphasis === 'total') added.font = { bold: true };
    });
    if (table.rows.length === 0 && table.emptyText && columns.length > 0) {
      sheet.addRow({ [columns[0].key]: table.emptyText });
    }
    // The filter covers the header and the data rows, not a closing total row; a two-row header
    // with merged cells has no single header row to filter on.
    const dataRows = table.rows.filter((row) => row.emphasis !== 'total').length;
    // Emphasis rows between data rows (a balance sheet's group headers) make a filter meaningless.
    const totalsOnlyAtEnd = table.rows.slice(0, dataRows).every((row) => row.emphasis !== 'total');
    if (headerRows === 1 && dataRows > 0 && columns.length > 0 && totalsOnlyAtEnd) {
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1 + dataRows, column: columns.length },
      };
    }
  }
}
