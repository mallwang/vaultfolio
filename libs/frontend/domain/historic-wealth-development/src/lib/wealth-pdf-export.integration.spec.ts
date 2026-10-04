import { exportFeature, type PdfSection } from '@vaultfolio/export';
import type { WealthSnapshot } from '@vaultfolio/api-contract';
import { de, en, type TranslationDictionary } from '@vaultfolio/frontend-shared-ui';
import { totalsOf } from '@vaultfolio/wealth';
import { buildWealthPdfSections } from './wealth-report';

/**
 * Renders the real wealth PDF from synthetic data (many classes, long names, six-figure amounts)
 * and reads it back with PDF.js: section order, the key figures and the balance sheet must be
 * present and inside the landscape page (FR-015, SC-006).
 */
interface PdfJsPage {
  view: number[];
  getTextContent(): Promise<{ items: unknown[] }>;
}
interface PdfJsLib {
  getDocument(src: { data: Uint8Array }): {
    promise: Promise<{ numPages: number; getPage(n: number): Promise<PdfJsPage> }>;
  };
}
interface Item {
  str: string;
  x: number;
  right: number;
}
interface Extracted {
  pageWidth: number;
  pages: Item[][];
}

async function extract(blob: Blob): Promise<Extracted> {
  // @ts-expect-error -- the worker entry ships without type declarations.
  const worker: unknown = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsLib;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const pages: Item[][] = [];
  let pageWidth = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    pageWidth = page.view[2];
    const { items } = await page.getTextContent();
    pages.push(
      (items as { str: string; transform: number[]; width: number }[])
        .filter((i) => i.str.trim() !== '')
        .map((i) => ({
          str: i.str.replace(/\s/g, ' '),
          x: i.transform[4],
          right: i.transform[4] + i.width,
        })),
    );
  }
  return { pageWidth, pages };
}

const tr = (dict: TranslationDictionary) => (key: string) =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as TranslationDictionary)?.[part], dict) as string;

const fmt = (locale: 'en' | 'de', value: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' })
    .format(Number(value))
    .replace(/\s/g, ' ');

function fixture(): WealthSnapshot[] {
  const classes = [
    'Edelmetalle-Sammlung',
    'Oldtimer Fuhrpark',
    'Kunstwerke und Antiquitäten',
    'Wein',
  ];
  return Array.from({ length: 8 }, (_, i) => ({
    id: `s${i}`,
    snapshotDate: `${2019 + i}-12-31`,
    entries: [
      {
        side: 'ASSET' as const,
        class: { standard: 'bankBalances' as const },
        name: 'Hauptkonto bei der Muster-Bank AG',
        amount: `${123456 + i * 1000}.00`,
      },
      {
        side: 'ASSET' as const,
        class: { standard: 'securities' as const },
        name: 'ETF-Sparplan',
        amount: `${654321 + i * 5000}.50`,
      },
      ...classes.map((c, k) => ({
        side: 'ASSET' as const,
        class: { custom: c },
        name: `${c} Position ${k}`,
        amount: `${10000 * (k + 1) + i}.00`,
      })),
      {
        side: 'LIABILITY' as const,
        class: { standard: 'mortgage' as const },
        name: 'Baudarlehen Eigenheim',
        amount: `${250000 - i * 10000}.00`,
      },
    ],
    createdAt: '',
    updatedAt: '',
  }));
}

function render(sections: PdfSection[], locale: 'en' | 'de') {
  return exportFeature(
    {
      featureId: 'historic-wealth-development',
      title: 'Wealth',
      infobox: 'About this export.',
      columns: [],
      rows: [],
      pdfSections: sections,
      locale,
      subtitle: 'synthetic',
    },
    'pdf',
  );
}

describe('wealth PDF with realistic data', () => {
  const snapshots = fixture();
  const latest = snapshots[snapshots.length - 1];
  let en_: Extracted;
  let de_: Extracted;

  beforeAll(async () => {
    en_ = await extract(
      await render(
        buildWealthPdfSections(snapshots, { classGroups: [] }, 'all', tr(en), 'en'),
        'en',
      ),
    );
    de_ = await extract(
      await render(
        buildWealthPdfSections(snapshots, { classGroups: [] }, 'all', tr(de), 'de'),
        'de',
      ),
    );
  }, 60_000);

  const text = (doc: Extracted, page?: number) =>
    (page === undefined ? doc.pages.flat() : doc.pages[page]).map((i) => i.str).join(' ');

  it('keeps every text item inside the landscape page', () => {
    for (const doc of [en_, de_]) {
      expect(doc.pageWidth).toBeGreaterThan(800);
      for (const item of doc.pages.flat()) {
        expect(item.x).toBeGreaterThanOrEqual(27);
        expect(item.right).toBeLessThanOrEqual(doc.pageWidth - 27);
      }
    }
  });

  it('shows the key figures, the tables in order and the balance sheet on its own page', () => {
    const all = text(en_);
    const totals = totalsOf(latest);
    expect(all).toContain(fmt('en', totals.net));
    expect(all).toContain(fmt('en', totals.assets));
    const order = ['Latest snapshot by class', 'Snapshots', 'Balance sheet as of'].map((s) =>
      all.indexOf(s),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const balancePage = en_.pages.findIndex((p) =>
      p.some((i) => i.str.startsWith('Balance sheet as of')),
    );
    expect(balancePage).toBeGreaterThan(0);
    expect(text(en_, balancePage)).toContain('Equity (net worth)');
    expect(text(en_, balancePage)).toContain('Total');
  });

  it('prints the same sum on both sides of the balance sheet', () => {
    const balancePage = en_.pages.findIndex((p) =>
      p.some((i) => i.str.startsWith('Balance sheet as of')),
    );
    const sum = fmt('en', totalsOf(latest).assets);
    const occurrences = text(en_, balancePage).split(sum).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('renders German headings and keeps long names', () => {
    const all = text(de_);
    expect(all).toContain('Letzter Stichtag nach Klasse');
    expect(all).toContain('Bilanz zum');
    expect(all).toContain('Kunstwerke');
  });
});
