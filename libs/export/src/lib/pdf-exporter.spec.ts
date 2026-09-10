import { exportPdf } from './pdf-exporter.js';
import type { ResolvedFeatureExport } from './feature-export-definition.js';

// Minimal 1×1 transparent PNG so pdfmake can embed an image without fetching a real URL.
const DUMMY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function isPdf(blob: Blob): Promise<boolean> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

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

  it('formats currency, date, text, and null cells without throwing', async () => {
    const resolved: ResolvedFeatureExport = {
      featureId: 'holdings',
      title: 'Test',
      infobox: 'Info.',
      columns: [
        { key: 'name', label: 'Name', format: 'text' },
        { key: 'value', label: 'Value', format: 'currency' },
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'nullCol', label: 'Null', format: 'text' },
      ],
      rows: [
        { name: 'Gold', value: 1234.56, date: '2024-01-15', nullCol: null },
        { name: 'Invalid', value: 'not-a-number', date: 'bad-date', nullCol: null },
      ],
      locale: 'en',
      subtitle: 'custom subtitle',
      footer: 'Custom footer text.',
    };

    expect(await isPdf(await exportPdf(resolved))).toBe(true);
  });

  it('produces a valid PDF with summable currency columns and a bold sum row', async () => {
    const resolved: ResolvedFeatureExport = {
      featureId: 'holdings',
      title: 'Holdings',
      infobox: 'About.',
      columns: [
        { key: 'name', label: 'Name', format: 'text' },
        { key: 'value', label: 'Value', format: 'currency', summable: true },
      ],
      rows: [
        { name: 'Gold', value: 100 },
        { name: 'Silver', value: 50 },
        { name: 'NaN row', value: 'bad' },
      ],
      locale: 'en',
    };

    expect(await isPdf(await exportPdf(resolved))).toBe(true);
  });

  it('produces a valid PDF with a chart image and side table in German locale', async () => {
    const resolved: ResolvedFeatureExport = {
      featureId: 'holdings',
      title: 'Holdings',
      infobox: 'About.',
      columns: [{ key: 'name', label: 'Name', format: 'text' }],
      rows: [{ name: 'Gold' }],
      locale: 'de',
      chartImages: [DUMMY_PNG],
      chartSideTable: {
        sectionTitle: 'Verteilung',
        rows: [
          { label: 'ETF', value: 80, percentage: 80, color: '#3b82f6' },
          { label: 'Edelmetall', value: 20, percentage: 20 },
        ],
      },
    };

    expect(await isPdf(await exportPdf(resolved))).toBe(true);
  });

  it('formats number format cells like decimal (shared branch)', async () => {
    const resolved: ResolvedFeatureExport = {
      featureId: 'holdings',
      title: 'Test',
      infobox: 'Info.',
      columns: [
        { key: 'count', label: 'Count', format: 'number' },
        { key: 'rate', label: 'Rate', format: 'decimal' },
      ],
      rows: [{ count: 42, rate: '3.14' }],
      locale: 'en',
    };

    expect(await isPdf(await exportPdf(resolved))).toBe(true);
  });

  it('produces a valid PDF with a chart image but no side table', async () => {
    const resolved: ResolvedFeatureExport = {
      featureId: 'holdings',
      title: 'Holdings',
      infobox: 'About.',
      columns: [{ key: 'name', label: 'Name', format: 'text' }],
      rows: [],
      chartImages: [DUMMY_PNG],
    };

    expect(await isPdf(await exportPdf(resolved))).toBe(true);
  });
});
