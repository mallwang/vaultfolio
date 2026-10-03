import { exportFeature, exportFileExtension } from './export-feature.js';
import type { ResolvedFeatureExport } from './feature-export-definition.js';

/** FR-014: the PDF-only `pdfSections` never change JSON/CSV/XLSX output. */
describe('exportFeature with pdfSections', () => {
  const base: ResolvedFeatureExport = {
    featureId: 'earnings',
    title: 'Earnings',
    infobox: 'About.',
    columns: [
      { key: 'employer', label: 'Employer', format: 'text' },
      { key: 'gross', label: 'Gross', format: 'currency', summable: true },
    ],
    rows: [
      { employer: 'Brightline', gross: '5000.00' },
      { employer: 'Mid', gross: '3000.50' },
    ],
    locale: 'en',
  };
  const withSections: ResolvedFeatureExport = {
    ...base,
    pdfSections: [{ kind: 'text', text: 'Only for the PDF' }],
  };

  it.each(['json', 'csv'] as const)('produces identical %s text', async (format) => {
    const plain = await exportFeature(base, format).then((b) => b.text());
    const sectioned = await exportFeature(withSections, format).then((b) => b.text());

    expect(sectioned).toBe(plain);
    expect(sectioned).not.toContain('Only for the PDF');
  });

  it('produces an identical xlsx workbook', async () => {
    const plain = Buffer.from(await (await exportFeature(base, 'xlsx')).arrayBuffer());
    const sectioned = Buffer.from(await (await exportFeature(withSections, 'xlsx')).arrayBuffer());

    // Same workbook structure; zip metadata timestamps may differ, so compare the parsed cells.
    const ExcelJS = await import('exceljs');
    const read = async (buffer: Buffer) => {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
      return wb.worksheets.map((ws) => ws.getSheetValues());
    };
    expect(await read(sectioned)).toEqual(await read(plain));
  });
});

describe('exportFileExtension', () => {
  const plain: ResolvedFeatureExport = {
    featureId: 'x',
    title: 'X',
    infobox: '',
    columns: [],
    rows: [],
  };
  const withTables: ResolvedFeatureExport = { ...plain, tables: [] };

  it('is zip only for a CSV export of tables', () => {
    expect(exportFileExtension(withTables, 'csv')).toBe('zip');
    expect(exportFileExtension(plain, 'csv')).toBe('csv');
    expect(exportFileExtension(withTables, 'xlsx')).toBe('xlsx');
    expect(exportFileExtension(withTables, 'json')).toBe('json');
    expect(exportFileExtension(withTables, 'pdf')).toBe('pdf');
  });

  it('returns a zip blob for CSV with tables', async () => {
    const blob = await exportFeature(withTables, 'csv');
    expect(blob.type).toBe('application/zip');
  });
});
