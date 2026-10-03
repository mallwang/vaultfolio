import JSZip from 'jszip';
import { exportCsv, exportCsvTables, exportTableCsvFiles } from './csv-exporter.js';
import type { ExportTable, ResolvedFeatureExport } from './feature-export-definition.js';

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

describe('exportCsv', () => {
  const columns: ResolvedFeatureExport['columns'] = [
    { key: 'name', label: 'Name', format: 'text' },
    { key: 'management', label: 'Management', format: 'text' },
    { key: 'quantity', label: 'Quantity', format: 'decimal' },
  ];

  it('produces a header-only CSV for 0 rows', async () => {
    const resolved: ResolvedFeatureExport = {
      featureId: 'holdings',
      title: 'Holdings',
      infobox: 'About holdings',
      columns,
      rows: [],
    };

    const csv: string = await exportCsv(resolved).text();

    expect(csv).toBe('Name,Management,Quantity');
  });

  it('RFC 4180-escapes commas, quotes, and newlines, and round-trips decimal strings exactly', async () => {
    const resolved: ResolvedFeatureExport = {
      featureId: 'holdings',
      title: 'Holdings',
      infobox: 'About holdings',
      columns,
      rows: [
        {
          name: 'Gold',
          management: 'Vanguard, Inc. "Global"',
          quantity: '10.123456789012345678',
        },
        { name: 'Bond\nFund', management: null, quantity: '0' },
      ],
    };

    const csv = await exportCsv(resolved).text();

    expect(csv).toBe(
      [
        'Name,Management,Quantity',
        'Gold,"Vanguard, Inc. ""Global""",10.123456789012345678',
        '"Bond\nFund",,0',
      ].join('\r\n'),
    );
  });
});

describe('exportTableCsvFiles', () => {
  const files = exportTableCsvFiles(TABLES);

  it('names one file per table in order with an ASCII-folded slug', () => {
    expect(files.map((f) => f.name)).toEqual(['01-arbeitgeber-ubersicht.csv', '02-leer.csv']);
  });

  it('writes BOM, labels, RFC 4180 quoting, CRLF, verbatim decimals, empty nulls and the total last', () => {
    expect(files[0].content).toBe(
      '﻿Arbeitgeber,Brutto,Quote,Monate\r\n' +
        '"A, ""Corp""",1234.50,0.6123,12\r\n' +
        'B,10.00,,3\r\n' +
        'Gesamt,1244.50,0.6000,15',
    );
  });

  it('writes a header-only file for zero rows', () => {
    expect(files[1].content).toBe('﻿Jahr');
  });
});

describe('exportCsvTables', () => {
  it('zips the table files', async () => {
    const zip = await JSZip.loadAsync(await (await exportCsvTables(TABLES)).arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(['01-arbeitgeber-ubersicht.csv', '02-leer.csv']);
    expect(await zip.files['02-leer.csv'].async('string')).toContain('Jahr');
  });
});
