import type {
  ExportTable,
  ExportTableRow,
  ResolvedFeatureExport,
} from './feature-export-definition.js';

/**
 * `ResolvedFeatureExport` -> JSON bytes. One object per row, keyed by each column's resolved
 * `label` (never a raw translation key) — see contracts/export-lib.md.
 *
 * Decimal-typed values are passed through untouched as their canonical decimal string (Principle
 * III — never converted to a native float).
 */
export function exportJson(resolved: ResolvedFeatureExport): Blob {
  if (resolved.tables) {
    return new Blob([JSON.stringify(tablesToObject(resolved.tables), null, 2)], {
      type: 'application/json',
    });
  }
  const objects = resolved.rows.map((row) => {
    const obj: Record<string, string | number | null> = {};
    for (const column of resolved.columns) {
      obj[column.label] = row[column.key] ?? null;
    }
    return obj;
  });
  const json = JSON.stringify(objects, null, 2);
  return new Blob([json], { type: 'application/json' });
}

type Cells = ExportTableRow['cells'];

function rowObject(table: ExportTable, cells: Cells) {
  const obj: Cells = {};
  for (const column of table.columns) {
    obj[column.key] = cells[column.key] ?? null;
  }
  return obj;
}

/**
 * Tables -> one object keyed by the stable `table.id`, rows keyed by the stable column `key`
 * (never by a translated label), so the shape is identical in every UI language. The
 * `emphasis: 'total'` row of a table with `totalKey` moves out of the list into that key
 * (`null` when absent). See contracts/export-tables.md.
 */
function tablesToObject(tables: ExportTable[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const table of tables) {
    const totalRow = table.totalKey
      ? table.rows.find((row) => row.emphasis === 'total')
      : undefined;
    const listed = table.totalKey
      ? table.rows.filter((row) => row.emphasis !== 'total')
      : table.rows;
    result[table.id] = listed.map((row) => rowObject(table, row.cells));
    if (table.totalKey) {
      result[table.totalKey] = totalRow ? rowObject(table, totalRow.cells) : null;
    }
  }
  return result;
}
