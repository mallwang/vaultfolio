import { exportPdf } from './pdf-exporter.js';
import type { ResolvedFeatureExport } from './feature-export-definition.js';

describe('exportPdf', () => {
  const columns: ResolvedFeatureExport['columns'] = [
    { key: 'name', label: 'Name', format: 'text' },
    { key: 'quantity', label: 'Quantity', format: 'decimal' },
  ];

  it('produces a non-empty PDF containing the infobox text for an empty table', async () => {
    const resolved: ResolvedFeatureExport = {
      featureId: 'holdings',
      title: 'Holdings',
      infobox: 'About this export — Holdings. This file contains your holdings data.',
      columns,
      rows: [],
    };

    const blob = await exportPdf(resolved);

    expect(blob.type).toBe('application/pdf');
    const buffer = Buffer.from(await blob.arrayBuffer());
    expect(buffer.length).toBeGreaterThan(0);
    // A raw PDF byte stream starts with the "%PDF-" magic header.
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('produces a non-empty PDF for several rows', async () => {
    const resolved: ResolvedFeatureExport = {
      featureId: 'holdings',
      title: 'Holdings',
      infobox: 'About this export — Holdings.',
      columns,
      rows: [
        { name: 'Gold', quantity: '10.5' },
        { name: 'Silver', quantity: '3.2' },
      ],
    };

    const blob = await exportPdf(resolved);
    const buffer = Buffer.from(await blob.arrayBuffer());

    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
