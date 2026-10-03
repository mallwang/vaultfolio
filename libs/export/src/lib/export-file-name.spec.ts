import { exportFileExtension } from './export-feature.js';
import {
  exportFileExtensionFor,
  exportFileName,
  sanitizeExportFileName,
} from './export-file-name.js';
import type { ExportFormat, ResolvedFeatureExport } from './feature-export-definition.js';

describe('export file name helpers', () => {
  it('uses zip only for csv with tables', () => {
    expect(exportFileExtensionFor('csv', true)).toBe('zip');
    expect(exportFileExtensionFor('csv', false)).toBe('csv');
  });

  it.each<ExportFormat>(['pdf', 'xlsx', 'json'])('keeps the %s extension with tables', (format) => {
    expect(exportFileExtensionFor(format, true)).toBe(format);
    expect(exportFileExtensionFor(format, false)).toBe(format);
  });

  it('replaces forbidden characters', () => {
    expect(sanitizeExportFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
  });

  it('builds the full file name', () => {
    expect(exportFileName('Bestände', 'xlsx', false)).toBe('Bestände.xlsx');
    expect(exportFileName('A/B', 'csv', true)).toBe('A_B.zip');
  });

  it('keeps exportFileExtension behavior', () => {
    const withTables = { tables: [] } as unknown as ResolvedFeatureExport;
    const without = {} as ResolvedFeatureExport;
    expect(exportFileExtension(withTables, 'csv')).toBe('zip');
    expect(exportFileExtension(without, 'csv')).toBe('csv');
    expect(exportFileExtension(withTables, 'pdf')).toBe('pdf');
  });
});
