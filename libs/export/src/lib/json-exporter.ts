import type { ResolvedFeatureExport } from './feature-export-definition.js';

/**
 * `ResolvedFeatureExport` -> JSON bytes. One object per row, keyed by each column's resolved
 * `label` (never a raw translation key) — see contracts/export-lib.md.
 *
 * Decimal-typed values are passed through untouched as their canonical decimal string (Principle
 * III — never converted to a native float).
 */
export function exportJson(resolved: ResolvedFeatureExport): Blob {
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
