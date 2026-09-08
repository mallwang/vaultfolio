import ExcelJS from 'exceljs';
import { exportXlsx } from './xlsx-exporter.js';
import type { ResolvedFeatureExport } from './feature-export-definition.js';

async function readWorkbook(blob: Blob): Promise<ExcelJS.Workbook> {
  const buffer = await blob.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

describe('exportXlsx', () => {
  const columns: ResolvedFeatureExport['columns'] = [
    { key: 'name', label: 'Name', format: 'text' },
    { key: 'quantity', label: 'Quantity', format: 'decimal' },
    { key: 'purchasedAt', label: 'Purchased', format: 'date' },
  ];

  it('produces a header-only sheet for 0 rows', async () => {
    const resolved: ResolvedFeatureExport = {
      featureId: 'holdings',
      title: 'Holdings',
      infobox: 'About holdings',
      columns,
      rows: [],
    };

    const blob = await exportXlsx(resolved);
    const workbook = await readWorkbook(blob);
    const sheet = workbook.worksheets[0];

    expect(sheet.getRow(1).getCell(1).value).toBe('Name');
    expect(sheet.getRow(1).getCell(2).value).toBe('Quantity');
    expect(sheet.rowCount).toBe(1);
  });

  it('writes typed cells and round-trips a decimal string as an exact number', async () => {
    const resolved: ResolvedFeatureExport = {
      featureId: 'holdings',
      title: 'Holdings',
      infobox: 'About holdings',
      columns,
      rows: [{ name: 'Gold', quantity: '10.5', purchasedAt: '2024-01-15' }],
    };

    const blob = await exportXlsx(resolved);
    const workbook = await readWorkbook(blob);
    const sheet = workbook.worksheets[0];
    const dataRow = sheet.getRow(2);

    expect(dataRow.getCell(1).value).toBe('Gold');
    expect(dataRow.getCell(2).value).toBe(10.5);
    expect(dataRow.getCell(3).value).toBeInstanceOf(Date);
  });
});
