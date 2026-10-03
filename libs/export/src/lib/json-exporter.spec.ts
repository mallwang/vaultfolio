import { exportJson } from './json-exporter.js';
import type { ExportTable, ResolvedFeatureExport } from './feature-export-definition.js';

async function readJson(blob: Blob): Promise<unknown> {
  const text = await blob.text();
  return JSON.parse(text);
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

describe('exportJson', () => {
  const columns: ResolvedFeatureExport['columns'] = [
    { key: 'name', label: 'Name', format: 'text' },
    { key: 'quantity', label: 'Quantity', format: 'decimal' },
  ];

  it('produces an empty JSON array for 0 rows', async () => {
    const resolved: ResolvedFeatureExport = {
      featureId: 'holdings',
      title: 'Holdings',
      infobox: 'About holdings',
      columns,
      rows: [],
    };

    const blob = exportJson(resolved);

    await expect(readJson(blob)).resolves.toEqual([]);
  });

  it('keys each object by the resolved column label and round-trips decimal strings exactly', async () => {
    const resolved: ResolvedFeatureExport = {
      featureId: 'holdings',
      title: 'Holdings',
      infobox: 'About holdings',
      columns,
      rows: [
        { name: 'Gold', quantity: '10.123456789012345678' },
        { name: 'Silver', quantity: null },
      ],
    };

    const blob = exportJson(resolved);

    await expect(readJson(blob)).resolves.toEqual([
      { Name: 'Gold', Quantity: '10.123456789012345678' },
      { Name: 'Silver', Quantity: null },
    ]);
  });
});

describe('exportJson with tables', () => {
  it('keys sections by table id and fields by column key, moving the total row out of the list', async () => {
    const json = await readJson(exportJson(withTables()));

    expect(json).toEqual({
      employers: [
        { employer: 'A, "Corp"', gross: '1234.50', ratio: '0.6123', months: 12 },
        { employer: 'B', gross: '10.00', ratio: null, months: 3 },
      ],
      careerTotal: { employer: 'Gesamt', gross: '1244.50', ratio: '0.6000', months: 15 },
      empty: [],
    });
    expect(Object.keys(json as object)).toEqual(['employers', 'careerTotal', 'empty']);
  });

  it('writes null for the total when the table has none', async () => {
    const tables = [{ ...TABLES[0], rows: [] }];
    await expect(readJson(exportJson(withTables(tables)))).resolves.toEqual({
      employers: [],
      careerTotal: null,
    });
  });
});
