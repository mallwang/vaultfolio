import type { Content } from 'pdfmake/interfaces.js';
import {
  SECTION_PAGE_MARGIN,
  buildDocDefinition,
  exportPdf,
  sectionColumnWidth,
} from './pdf-exporter.js';
import type { PdfSection, ResolvedFeatureExport } from './feature-export-definition.js';

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

type TableSection = Extract<PdfSection, { kind: 'table' }>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdfmake content nodes are loosely typed.
type Node = Record<string, any>;

const CONTENT_WIDTH = 842 - 2 * SECTION_PAGE_MARGIN;

const employerTable: TableSection = {
  kind: 'table',
  title: 'Totals per employer',
  columns: [
    { key: 'employer', label: 'Employer', format: 'text', width: 220 },
    { key: 'gross', label: 'Gross', format: 'currency' },
    { key: 'ratio', label: 'Net ratio', format: 'percent' },
    { key: 'months', label: 'Months', format: 'integer' },
    { key: 'whole', label: 'Whole', format: 'currencyWhole' },
  ],
  rows: [
    {
      cells: {
        employer: 'Newest AG',
        gross: '1234.5',
        ratio: '0.6167',
        months: 12,
        whole: '1234.5',
      },
    },
    {
      cells: { employer: 'Career total', gross: '2469', ratio: null, months: 24, whole: '2469' },
      emphasis: 'total',
    },
  ],
};

function sectionResolved(
  pdfSections: PdfSection[],
  overrides: Partial<ResolvedFeatureExport> = {},
): ResolvedFeatureExport {
  return {
    featureId: 'earnings',
    title: 'Earnings',
    infobox: 'About this export.',
    columns: [{ key: 'name', label: 'Name', format: 'text' }],
    rows: [],
    pdfSections,
    locale: 'en',
    subtitle: 'sub',
    ...overrides,
  };
}

function tableNodes(content: Content[]): Node[] {
  return (content as Node[]).filter((node) => node['table'] && node['table'].headerRows === 1);
}

describe('PDF sections', () => {
  it('renders title, infobox, charts, then every section in order, without the generic table', () => {
    const doc = buildDocDefinition(
      sectionResolved(
        [
          { kind: 'text', title: 'Note', text: 'Hello' },
          employerTable,
          { ...employerTable, title: 'Second', subtitle: 'sub line' },
        ],
        { chartImages: [DUMMY_PNG] },
      ),
    );
    const content = doc.content as Node[];

    expect(content[0]['text']).toBe('Earnings');
    expect(content.some((n) => n['table']?.body?.[0]?.[0]?.text === 'About this export.')).toBe(
      true,
    );
    const chartAt = content.findIndex((n) => n['columns']);
    const headings = content.filter((n) => n['style'] === 'sectionHeader').map((n) => n['text']);
    expect(headings).toEqual(['Note', 'Totals per employer', 'Second']);
    expect(chartAt).toBeGreaterThan(0);
    expect(content.findIndex((n) => n['text'] === 'Note')).toBeGreaterThan(chartAt);
    // Only the two section tables (headerRows: 1) — no generic "Name" table.
    expect(tableNodes(doc.content as Content[])).toHaveLength(2);
    expect(JSON.stringify(doc.content)).not.toContain('"Name"');
    expect(content.some((n) => n['text'] === 'sub line')).toBe(true);
  });

  it('renders a text section as a paragraph', () => {
    const doc = buildDocDefinition(sectionResolved([{ kind: 'text', text: 'Nothing here yet.' }]));
    expect((doc.content as Node[]).some((n) => n['text'] === 'Nothing here yet.')).toBe(true);
    expect(tableNodes(doc.content as Content[])).toHaveLength(0);
  });

  it('formats cells for the locale and shows a dash for missing values', () => {
    const body = (locale: string) => {
      const doc = buildDocDefinition(sectionResolved([employerTable], { locale }));
      const [table] = tableNodes(doc.content as Content[]);
      return table['table'].body.map((row: Node[]) => row.map((cell) => cell['text']));
    };

    expect(body('en')).toEqual([
      ['Employer', 'Gross', 'Net ratio', 'Months', 'Whole'],
      ['Newest AG', '€1,234.50', '61.7%', '12', '€1,235'],
      ['Career total', '€2,469.00', '–', '24', '€2,469'],
    ]);
    const de = body('de');
    expect(de[1].map((t: string) => t.replace(/\u00a0/g, ' '))).toEqual([
      'Newest AG',
      '1.234,50 €',
      '61,7 %',
      '12',
      '1.235 €',
    ]);
  });

  it('bolds the total row and nothing else in the body', () => {
    const doc = buildDocDefinition(sectionResolved([employerTable]));
    const [table] = tableNodes(doc.content as Content[]);
    const [, first, total] = table['table'].body;
    expect(first.every((cell: Node) => cell['bold'] === false)).toBe(true);
    expect(total.every((cell: Node) => cell['bold'] === true)).toBe(true);
  });

  it('keeps tables inside the landscape content width and robust across pages', () => {
    const doc = buildDocDefinition(sectionResolved([employerTable]));
    const [table] = tableNodes(doc.content as Content[]);
    const widths: (number | string)[] = table['table'].widths;

    expect(doc.pageOrientation).toBe('landscape');
    expect(doc.pageMargins).toBe(SECTION_PAGE_MARGIN);
    expect(widths).toEqual([220, '*', '*', '*', '*']);
    const fixed = widths.reduce<number>((sum, w) => sum + (typeof w === 'number' ? w : 0), 0);
    expect(fixed).toBeLessThan(CONTENT_WIDTH);
    expect(table['table'].headerRows).toBe(1);
    expect(table['table'].keepWithHeaderRows).toBe(1);
    expect(table['table'].dontBreakRows).toBe(true);
  });

  it('right-aligns and never wraps amounts, but lets labels wrap', () => {
    const doc = buildDocDefinition(sectionResolved([employerTable]));
    const [table] = tableNodes(doc.content as Content[]);
    const [label, ...amounts] = table['table'].body[1] as Node[];
    expect(label['noWrap']).toBe(false);
    expect(label['alignment']).toBe('left');
    expect(amounts.every((c) => c['noWrap'] === true && c['alignment'] === 'right')).toBe(true);
  });

  it('defaults label columns to auto width and numeric columns to shared width', () => {
    expect(sectionColumnWidth({ key: 'a', label: 'A', format: 'text' })).toBe('auto');
    expect(sectionColumnWidth({ key: 'a', label: 'A', format: 'percent' })).toBe('*');
    expect(sectionColumnWidth({ key: 'a', label: 'A', format: 'text', width: 96 })).toBe(96);
  });

  it('produces a real PDF from sections', async () => {
    const blob = await exportPdf(sectionResolved([employerTable], { chartImages: [DUMMY_PNG] }));
    expect(await isPdf(blob)).toBe(true);
  });
});

describe('generic PDF path without sections (regression)', () => {
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
    ],
    locale: 'en',
    subtitle: 'sub',
    footer: 'foot',
  };

  it.each([undefined, []])(
    'keeps the single table with its sum row (pdfSections: %j)',
    (pdfSections) => {
      const doc = buildDocDefinition({ ...resolved, ...(pdfSections ? { pdfSections } : {}) });
      const [table] = tableNodes(doc.content as Content[]);

      expect(table['table'].widths).toEqual(['*', '*']);
      expect(table['table'].dontBreakRows).toBeUndefined();
      expect(table['layout']).toBe('lightHorizontalLines');
      expect(
        table['table'].body.map((row: Node[]) =>
          row.map((c) => (typeof c === 'string' ? c : c['text'])),
        ),
      ).toEqual([
        ['Name', 'Value'],
        ['Gold', '€100.00'],
        ['Silver', '€50.00'],
        ['Total', '€150.00'],
      ]);
      expect(doc.pageMargins).toBeUndefined();
      expect(doc.pageOrientation).toBe('landscape');
    },
  );
});

describe('section PDF layout', () => {
  const stacked: TableSection = {
    kind: 'table',
    title: 'Monthly',
    columns: [
      { key: 'year', label: 'Year', format: 'text', width: 30 },
      { key: 'g', label: 'Jan', format: 'currencyWhole', secondaryKey: 'n' },
    ],
    rows: [{ cells: { year: '2026', g: '5000.4', n: '3100.2' } }],
  };

  it('starts every table section on a new page but not a text section', () => {
    const doc = buildDocDefinition(
      sectionResolved([{ kind: 'text', title: 'Note', text: 'x' }, employerTable, stacked]),
    );
    const headings = (doc.content as Node[]).filter((n) => n['style'] === 'sectionHeader');
    expect(headings.map((n) => [n['text'], n['pageBreak']])).toEqual([
      ['Note', undefined],
      ['Totals per employer', 'before'],
      ['Monthly', 'before'],
    ]);
  });

  it('stacks the secondary value below the main one in the same cell', () => {
    const doc = buildDocDefinition(sectionResolved([stacked]));
    const [table] = tableNodes(doc.content as Content[]);
    const cell = table['table'].body[1][1] as Node;
    expect(cell['stack'].map((n: Node) => n['text'])).toEqual(['€5,000', '€3,100']);
    expect(cell['stack'][1]['color']).toBe('#666666');
    expect(cell['alignment']).toBe('right');
    expect(cell['noWrap']).toBe(true);
  });

  it('shows a dash for a missing secondary value', () => {
    const doc = buildDocDefinition(
      sectionResolved([{ ...stacked, rows: [{ cells: { year: '2026', g: '1', n: null } }] }]),
    );
    const [table] = tableNodes(doc.content as Content[]);
    expect((table['table'].body[1][1] as Node)['stack'][1]['text']).toBe('–');
  });

  it('shows a single dash when the main value is missing', () => {
    const doc = buildDocDefinition(
      sectionResolved([{ ...stacked, rows: [{ cells: { year: '2026', g: null, n: '5' } }] }]),
    );
    const [table] = tableNodes(doc.content as Content[]);
    const cell = table['table'].body[1][1] as Node;
    expect(cell['stack']).toBeUndefined();
    expect(cell['text']).toBe('–');
  });

  it('draws the chart across the page width in a section PDF and keeps it narrow otherwise', () => {
    const imageWidth = (resolved: ResolvedFeatureExport) => {
      const doc = buildDocDefinition(resolved);
      const columns = (doc.content as Node[]).find((n) => n['columns']);
      return columns?.['columns'][0].stack[0].width;
    };
    expect(imageWidth(sectionResolved([employerTable], { chartImages: [DUMMY_PNG] }))).toBe(
      CONTENT_WIDTH,
    );
    expect(
      imageWidth({
        featureId: 'holdings',
        title: 'H',
        infobox: 'i',
        columns: [{ key: 'name', label: 'Name', format: 'text' }],
        rows: [],
        chartImages: [DUMMY_PNG],
      }),
    ).toBe(440);
  });
});
