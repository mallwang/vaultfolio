import { exportJson } from './json-exporter.js';
import type { ResolvedFeatureExport } from './feature-export-definition.js';

async function readJson(blob: Blob): Promise<unknown> {
  const text = await blob.text();
  return JSON.parse(text);
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
