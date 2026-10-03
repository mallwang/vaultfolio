import ExcelJS from 'exceljs';
import { exportXlsx } from './xlsx-exporter.js';
import type { ExportTable, ResolvedFeatureExport } from './feature-export-definition.js';

async function readWorkbook(blob: Blob): Promise<ExcelJS.Workbook> {
  const buffer = await blob.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

const TABLES: ExportTable[] = [
  {
    id: 'employers',
    title: 'Arbeitgeber / Übersicht',
    totalKey: 'careerTotal',
    columns: [
      { key: 'employer', label: 'Arbeitgeber', format: 'text' },
      { key: 'gross', label: 'Brutto', format: 'money' },
      { key: 'ratio', label: 'Quote', format: 'ratio' },
      { key: 'months', label: 'Monate', format: 'integer' },
    ],
    rows: [
      { cells: { employer: 'A, "Corp"', gross: '1234.50', ratio: '0.6123', months: 12 } },
      { cells: { employer: 'B', gross: '10.00', ratio: null, months: 3 } },
      {
        cells: { employer: 'Gesamt', gross: '1244.50', ratio: '0.6000', months: 15 },
        emphasis: 'total',
      },
    ],
  },
  {
    id: 'empty',
    title: 'Leer',
    columns: [{ key: 'year', label: 'Jahr', format: 'integer' }],
    rows: [],
  },
];

function withTables(tables: ExportTable[] = TABLES): ResolvedFeatureExport {
  return { featureId: 'earnings', title: 'Earnings', infobox: '', columns: [], rows: [], tables };
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

  it('converts null to null cell, currency strings to numbers, and number format to numbers', async () => {
    const resolved: ResolvedFeatureExport = {
      featureId: 'test',
      title: 'Test',
      infobox: 'Info',
      columns: [
        { key: 'price', label: 'Price', format: 'currency' },
        { key: 'amount', label: 'Amount', format: 'number' },
        { key: 'empty', label: 'Empty', format: 'text' },
      ],
      rows: [{ price: '99.99', amount: 5, empty: null }],
    };

    const blob = await exportXlsx(resolved);
    const workbook = await readWorkbook(blob);
    const sheet = workbook.worksheets[0];
    const dataRow = sheet.getRow(2);

    expect(Number(dataRow.getCell(1).value)).toBeCloseTo(99.99, 6);
    expect(dataRow.getCell(2).value).toBe(5);
    expect(dataRow.getCell(3).value).toBeNull();
  });

  it('applies currency number format to header column style', async () => {
    const resolved: ResolvedFeatureExport = {
      featureId: 'test',
      title: 'Test',
      infobox: 'Info',
      columns: [{ key: 'value', label: 'Value', format: 'currency' }],
      rows: [],
    };

    const blob = await exportXlsx(resolved);
    const workbook = await readWorkbook(blob);
    const sheet = workbook.worksheets[0];

    expect(sheet.columns[0].numFmt).toBe('€#,##0.00');
  });
});

describe('exportXlsx with tables', () => {
  it('writes one sheet per table with a sanitised, unique, short name', async () => {
    const long = 'x'.repeat(40);
    const workbook = await readWorkbook(
      await exportXlsx(
        withTables([
          { ...TABLES[0], title: 'A/B:[C]' },
          { ...TABLES[1], title: long },
          { ...TABLES[1], title: long },
        ]),
      ),
    );
    const names = workbook.worksheets.map((s) => s.name);
    expect(names).toEqual(['ABC', 'x'.repeat(31), `${'x'.repeat(29)} 2`]);
  });

  it('types and formats cells, bolds header and total, freezes the header', async () => {
    const workbook = await readWorkbook(await exportXlsx(withTables()));
    const sheet = workbook.worksheets[0];

    expect(sheet.getRow(1).values).toEqual([undefined, 'Arbeitgeber', 'Brutto', 'Quote', 'Monate']);
    expect(sheet.getRow(1).font?.bold).toBe(true);
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });

    const first = sheet.getRow(2);
    expect(Number(first.getCell(2).value)).toBeCloseTo(1234.5, 6);
    expect(first.getCell(2).numFmt).toBe('#,##0.00 "€"');
    expect(Number(first.getCell(3).value)).toBeCloseTo(0.6123, 6);
    expect(first.getCell(3).numFmt).toBe('0.0%');
    expect(first.getCell(4).value).toBe(12);
    expect(sheet.getRow(3).getCell(3).value).toBeNull();
    expect(sheet.getRow(4).font?.bold).toBe(true);
    expect(sheet.getRow(2).font?.bold).not.toBe(true);
  });

  it('writes a header-only sheet for a table without rows', async () => {
    const workbook = await readWorkbook(await exportXlsx(withTables()));
    const sheet = workbook.worksheets[1];
    expect(sheet.rowCount).toBe(1);
    expect(sheet.getRow(1).getCell(1).value).toBe('Jahr');
  });
});
