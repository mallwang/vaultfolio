import { exportCsv } from './csv-exporter.js';
import type { ResolvedFeatureExport } from './feature-export-definition.js';

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
