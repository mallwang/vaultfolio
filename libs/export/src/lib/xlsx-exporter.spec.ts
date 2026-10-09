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

  it('writes formulas with cached results and SUM in the total row', async () => {
    const table: ExportTable = {
      id: 't',
      title: 'F',
      columns: [
        { key: 'name', label: 'Name', format: 'text' },
        { key: 'gross', label: 'Brutto', format: 'money', sumInTotal: true },
        { key: 'tax', label: 'Steuern', format: 'money', sumInTotal: true },
        { key: 'pct', label: '%', format: 'ratio', formula: 'IF({gross}=0,0,{tax}/{gross})' },
      ],
      rows: [
        { cells: { name: 'A', gross: '100.00', tax: '20.00', pct: '0.2000' } },
        { cells: { name: 'B', gross: '300.00', tax: '30.00', pct: '0.1000' } },
        { cells: { name: 'Σ', gross: '400.00', tax: '50.00', pct: '0.1250' }, emphasis: 'total' },
      ],
    };
    const sheet = (await readWorkbook(await exportXlsx(withTables([table])))).worksheets[0];

    expect(sheet.getCell('D2').value).toEqual({ formula: 'IF(B2=0,0,C2/B2)', result: 0.2 });
    expect(sheet.getCell('B4').value).toEqual({ formula: 'SUM(B2:B3)', result: 400 });
    expect(sheet.getCell('C4').value).toEqual({ formula: 'SUM(C2:C3)', result: 50 });
    expect(sheet.getCell('D4').value).toEqual({ formula: 'IF(B4=0,0,C4/B4)', result: 0.125 });
  });

  it('keeps the plain value when formulaNeedsValues finds an empty referenced cell', async () => {
    const table: ExportTable = {
      id: 't',
      title: 'N',
      columns: [
        { key: 'qty', label: 'Menge', format: 'decimal' },
        { key: 'price', label: 'Preis', format: 'money' },
        {
          key: 'sum',
          label: 'Summe',
          format: 'money',
          formula: '{qty}*{price}',
          formulaNeedsValues: true,
        },
      ],
      rows: [
        { cells: { qty: '2', price: '1.50', sum: '3.00' } },
        { cells: { qty: null, price: null, sum: '10.00' } },
      ],
    };
    const sheet = (await readWorkbook(await exportXlsx(withTables([table])))).worksheets[0];

    expect(sheet.getCell('C2').value).toEqual({ formula: 'A2*B2', result: 3 });
    expect(sheet.getCell('C3').value).toBe(10);
  });

  it('merges a grouped two-row header and skips hidden columns', async () => {
    const table: ExportTable = {
      id: 't',
      title: 'G',
      columns: [
        { key: 'year', label: 'Jahr', format: 'integer' },
        {
          key: 'g1',
          label: 'Brutto Jan',
          format: 'money',
          excel: { group: 'Jan', label: 'Brutto' },
        },
        { key: 'n1', label: 'Netto Jan', format: 'money', excel: { group: 'Jan', label: 'Netto' } },
        { key: 'sum', label: 'Summe', format: 'money', excel: { hidden: true } },
      ],
      rows: [{ cells: { year: 2026, g1: '10.00', n1: '6.00', sum: '10.00' } }],
    };
    const sheet = (await readWorkbook(await exportXlsx(withTables([table])))).worksheets[0];

    expect(sheet.columns).toHaveLength(3);
    expect(sheet.getCell('A1').value).toBe('Jahr');
    expect(sheet.getCell('B1').value).toBe('Jan');
    expect(sheet.getCell('C1').master.address).toBe('B1');
    expect(sheet.getCell('A2').master.address).toBe('A1');
    expect([sheet.getCell('B2').value, sheet.getCell('C2').value]).toEqual(['Brutto', 'Netto']);
    expect(Number(sheet.getCell('B3').value)).toBe(10);
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 2 });
    expect(sheet.autoFilter).toBeUndefined();
  });

  it('writes date cells in German format and {prev:key} formulas from the second data row on', async () => {
    const table: ExportTable = {
      id: 't',
      title: 'D',
      columns: [
        { key: 'date', label: 'Datum', format: 'date' },
        { key: 'net', label: 'Netto', format: 'money' },
        { key: 'delta', label: 'Delta', format: 'money', formula: '{net}-{prev:net}' },
      ],
      rows: [
        { cells: { date: '2025-01-31', net: '100.00', delta: null } },
        { cells: { date: '2025-06-30', net: '150.00', delta: '50.00' } },
      ],
    };
    const sheet = (await readWorkbook(await exportXlsx(withTables([table])))).worksheets[0];

    expect(sheet.getCell('A2').value).toEqual(new Date('2025-01-31T00:00:00Z'));
    expect(sheet.getCell('A2').numFmt).toBe('dd.mm.yyyy');
    expect(sheet.getCell('C2').value).toBeNull();
    expect(sheet.getCell('C3').value).toEqual({ formula: 'B3-B2', result: 50 });
  });

  it('uses ISO dates and a leading euro sign outside German', async () => {
    const table: ExportTable = {
      id: 't',
      title: 'D',
      columns: [
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'net', label: 'Net', format: 'money' },
      ],
      rows: [{ cells: { date: '2025-01-31', net: '100.00' } }],
    };
    const sheet = (await readWorkbook(await exportXlsx({ ...withTables([table]), locale: 'en' })))
      .worksheets[0];

    expect(sheet.getCell('A2').numFmt).toBe('yyyy-mm-dd');
    expect(sheet.getCell('B2').numFmt).toBe('"€"#,##0.00');
  });

  it('keeps the filter off when emphasis rows sit between data rows', async () => {
    const table: ExportTable = {
      id: 't',
      title: 'B',
      columns: [{ key: 'label', label: 'Label', format: 'text' }],
      rows: [
        { cells: { label: 'Header' }, emphasis: 'total' },
        { cells: { label: 'Entry' } },
        { cells: { label: 'Sum' }, emphasis: 'total' },
      ],
    };
    const sheet = (await readWorkbook(await exportXlsx(withTables([table])))).worksheets[0];
    expect(sheet.autoFilter).toBeUndefined();
  });
});
