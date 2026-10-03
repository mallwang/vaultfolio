import type { ExportTable, ResolvedFeatureExport } from './feature-export-definition.js';

/**
 * RFC 4180 CSV field escaping: a field containing a comma, double quote, or newline (CR/LF) is
 * wrapped in double quotes, with any double quote inside it doubled.
 */
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function cellToString(value: string | number | null): string {
  if (value === null) {
    return '';
  }
  return String(value);
}

/**
 * `ResolvedFeatureExport` -> RFC 4180 CSV bytes, one header row (resolved column labels) + one
 * row per record. Decimal-typed values pass through as their canonical decimal string, never a
 * native float (Principle III).
 */
export function exportCsv(resolved: ResolvedFeatureExport): Blob {
  const lines: string[] = [];
  lines.push(resolved.columns.map((column) => escapeCsvField(column.label)).join(','));
  for (const row of resolved.rows) {
    lines.push(
      resolved.columns.map((column) => escapeCsvField(cellToString(row[column.key]))).join(','),
    );
  }
  const csv = lines.join('\r\n');
  return new Blob([csv], { type: 'text/csv' });
}

/** ASCII-folded, lower-case, hyphenated: "Brutto pro Jahr" -> "brutto-pro-jahr". */
function slugify(title: string): string {
  const slug = title
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('-');
  return slug || 'table';
}

const BOM = '\uFEFF';

/**
 * One CSV file per table: `NN-<slug>.csv`, UTF-8 with BOM (so Excel shows umlauts), RFC 4180
 * quoting, CRLF, translated labels as header, amounts verbatim as canonical decimal strings. Shared
 * by the single export (ZIP) and the "Export my data" archive (flat files).
 */
export function exportTableCsvFiles(tables: ExportTable[]): { name: string; content: string }[] {
  return tables.map((table, index) => {
    const lines = [table.columns.map((column) => escapeCsvField(column.label)).join(',')];
    for (const row of table.rows) {
      lines.push(
        table.columns
          .map((column) => escapeCsvField(cellToString(row.cells[column.key] ?? null)))
          .join(','),
      );
    }
    return {
      name: `${String(index + 1).padStart(2, '0')}-${slugify(table.title)}.csv`,
      content: BOM + lines.join('\r\n'),
    };
  });
}

/**
 * Tables -> ZIP with one CSV file per table. Deferred `import('jszip')`, like the archive, so the
 * library barrel does not pull the ZIP library into an eagerly loaded bundle.
 */
export async function exportCsvTables(tables: ExportTable[]): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const file of exportTableCsvFiles(tables)) {
    zip.file(file.name, file.content);
  }
  return zip.generateAsync({ type: 'blob' });
}
