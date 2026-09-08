import type { ResolvedFeatureExport } from './feature-export-definition.js';

/**
 * RFC 4180 CSV field escaping: a field containing a comma, double quote, or newline (CR/LF) is
 * wrapped in double quotes, with any double quote inside it doubled.
 */
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
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
