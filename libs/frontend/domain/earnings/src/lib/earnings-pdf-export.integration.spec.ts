import type {
  CareerEntry,
  EarningsOverview,
  EarningsTables,
  TaxYearRow,
} from '@vaultfolio/api-contract';
import { exportFeature, type PdfSection } from '@vaultfolio/export';
import { de, en, type TranslationDictionary } from '@vaultfolio/frontend-shared-ui';
import { buildEarningsPdfSections } from './earnings-pdf-sections';

/**
 * Renders the real earnings PDF from maximum-size synthetic data (20 years, 8 employers, six-figure
 * amounts, long names) and reads it back with PDF.js: every header and amount must be present and
 * inside the landscape page (FR-007/FR-008, SC-001).
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
  y: number;
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
          y: i.transform[5],
        })),
    );
  }
  return { pageWidth, pages };
}

const tr = (dict: TranslationDictionary) => (key: string) =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as TranslationDictionary)?.[part], dict) as string;

const EMPLOYER_NAMES = [
  'Brightline Software Entwicklungs- und Beratungsgesellschaft mbH',
  'Hanseatische Maschinenbau und Anlagentechnik AG & Co. KG',
  'Süddeutsche Versicherungs-Dienstleistungs-Gesellschaft mbH',
  'Rheinisch-Westfälische Logistikholding Verwaltungs GmbH',
  'Nordlicht Energie Netze Betriebsführungs GmbH',
  'Alpenland Gastronomie Betriebs GmbH',
  'Kurpfalz Medizintechnik International SE',
  'Mitteldeutsche Bildungs- und Forschungsgesellschaft mbH',
];

function money(n: number): string {
  return n.toFixed(2);
}

function maxData(): { overview: EarningsOverview; tables: EarningsTables } {
  const years = Array.from({ length: 20 }, (_, i) => 2026 - i);
  const career: CareerEntry[] = EMPLOYER_NAMES.map((label, i) => {
    const gross = 987654.32 + i * 1111.11;
    return {
      key: `e${i}`,
      label,
      firstPeriod: `${2007 + i * 2}-01`,
      lastPeriod: `${2008 + i * 2}-12`,
      monthsEmployed: 24,
      employerCount: 1,
      totals: {
        gross: money(gross),
        net: money(gross * 0.6),
        taxes: money(gross * 0.22),
        social: money(gross * 0.18),
        bonus: money(gross * 0.1),
      },
      perMonth: { gross: '0.00', net: '0.00', taxes: '0.00', social: '0.00', bonus: '0.00' },
      netRatio: '0.6000',
    };
  });
  const sum = (key: keyof CareerEntry['totals']) =>
    career.reduce((acc, e) => acc + Math.round(Number(e.totals[key]) * 100), 0) / 100;
  career.unshift({
    key: 'ALL',
    label: 'All',
    firstPeriod: '2007-01',
    lastPeriod: '2022-12',
    monthsEmployed: 192,
    employerCount: 8,
    totals: {
      gross: money(sum('gross')),
      net: money(sum('net')),
      taxes: money(sum('taxes')),
      social: money(sum('social')),
      bonus: money(sum('bonus')),
    },
    perMonth: { gross: '0.00', net: '0.00', taxes: '0.00', social: '0.00', bonus: '0.00' },
    netRatio: '0.6000',
  });

  const gross: Record<string, string> = {};
  for (const year of years)
    for (let m = 1; m <= 12; m++)
      gross[`${year}-${String(m).padStart(2, '0')}`] = money(123456.78 + year + m);

  const taxesPerYear: TaxYearRow[] = years.flatMap((year, i) =>
    [0, 1].map((k) => ({
      year,
      employerId: `e${(i + k) % 8}`,
      employerLabel: EMPLOYER_NAMES[(i + k) % 8],
      monthsEmployed: 12,
      gross: money(654321.09 + year),
      bonus: money(123456.78),
      taxGross: money(654321.09 + year),
      wageTax: money(123456.78),
      soli: money(12345.67),
      churchTax: money(11234.56),
      health: money(10234.56),
      care: money(2234.56),
      pension: money(120345.67),
      unemployment: money(1234.56),
      taxRatio: '0.2212',
      socialRatio: '0.1888',
    })),
  );

  return {
    overview: {
      hasData: true,
      career,
      latestYear: null,
      yearly: [],
      monthly: [],
      employerChanges: [],
      dataCheckIssues: 0,
    },
    tables: {
      monthGrid: {
        years,
        metrics: {
          gross,
          regular: {},
          bonus: {},
          net: {},
          taxes: {},
          social: {},
          payout: {},
        },
        bonusPeriods: [],
        missingPeriods: [],
      },
      taxesPerYear,
      certificates: [],
    },
  };
}

function render(sections: PdfSection[], locale: 'en' | 'de') {
  return exportFeature(
    {
      featureId: 'earnings',
      title: 'Earnings',
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

const fmt = (locale: 'en' | 'de', value: string, whole = false) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })
    .format(Number(value))
    .replace(/\s/g, ' ');

describe('earnings PDF with maximum realistic data', () => {
  const { overview, tables } = maxData();
  let en_: Extracted;
  let de_: Extracted;
  let elapsedMs = Number.POSITIVE_INFINITY;

  beforeAll(async () => {
    const t0 = performance.now();
    en_ = await extract(
      await render(buildEarningsPdfSections(overview, tables, tr(en), 'en'), 'en'),
    );
    const elapsed = performance.now() - t0;
    de_ = await extract(
      await render(buildEarningsPdfSections(overview, tables, tr(de), 'de'), 'de'),
    );
    elapsedMs = elapsed;
  }, 60_000);

  it('generates well within the 3 s goal (generous bound for slow CI)', () => {
    expect(elapsedMs).toBeLessThan(10_000);
  });

  it('keeps every text item inside the landscape page', () => {
    for (const doc of [en_, de_]) {
      expect(doc.pageWidth).toBeGreaterThan(800);
      for (const item of doc.pages.flat()) {
        expect(item.x).toBeGreaterThanOrEqual(27);
        expect(item.right).toBeLessThanOrEqual(doc.pageWidth - 27);
      }
    }
  });

  it('spreads the tables over several pages and repeats the tax table header on each', () => {
    expect(en_.pages.length).toBeGreaterThan(2);
    const pagesWithTaxHeader = en_.pages.filter((p) => p.some((i) => i.str === 'Unempl.'));
    expect(pagesWithTaxHeader.length).toBeGreaterThan(1);
    // The repeated header is the first row of the continuation pages' tax table.
    const pagesWithGrid = en_.pages.filter((p) => p.some((i) => i.str === 'Sum'));
    expect(pagesWithGrid.length).toBeGreaterThanOrEqual(1);
  });

  it('shows every employer row and the career total with full amounts', () => {
    const text = en_.pages
      .flat()
      .map((i) => i.str)
      .join('\n');
    const compact = text.replace(/\s+/g, ' ');
    for (const employer of overview.career.filter((c) => c.key !== 'ALL')) {
      // Long names wrap inside their cell: check their first words.
      expect(compact).toContain(employer.label.split(' ')[0]);
      expect(text).toContain(fmt('en', employer.totals.gross));
      expect(text).toContain(fmt('en', employer.totals.bonus));
    }
    const total = overview.career.find((c) => c.key === 'ALL');
    expect(text).toContain('Career total');
    expect(text).toContain(fmt('en', total?.totals.gross ?? ''));
  });

  it('moves the 8 employers to their own page and starts the other tables on new pages', () => {
    const titles = [
      'Totals per employer',
      'Monthly overview gross / net',
      'All taxes and contributions per year',
    ];
    const pageIndexOf = (title: string) =>
      en_.pages.findIndex((p) => p.some((i) => i.str === title));
    const [employers, monthly, taxes] = titles.map(pageIndexOf);
    const firstPageText = en_.pages[0].map((i) => i.str);
    expect(firstPageText).toContain('Earnings');
    // More than 6 employers do not fit below the chart.
    expect(firstPageText).not.toContain(titles[0]);
    expect(employers).toBe(1);
    expect(en_.pages[employers][0]?.str).toBe(titles[0]);
    expect(en_.pages[monthly][0]?.str).toBe(titles[1]);
    expect(en_.pages[taxes][0]?.str).toBe(titles[2]);
    expect(monthly).toBe(2);
    expect(taxes).toBeGreaterThan(monthly);
  });

  it('repeats the own-account notice as footer on every page', () => {
    for (const page of en_.pages) {
      expect(page.some((i) => i.str.includes('own account'))).toBe(true);
    }
  });

  it('shows net below gross in the monthly overview', () => {
    const flat = en_.pages.flat();
    const gross = flat.find((i) => i.str === fmt('en', String(123456.78 + 2026 + 1), true));
    expect(gross).toBeDefined();
    // The same column holds two stacked values; net is not part of this data set, so the second
    // line is the dash placeholder directly beneath.
    const below = flat.find(
      (i) => i.str === '–' && Math.abs(i.right - (gross?.right ?? 0)) < 1 && i.y < (gross?.y ?? 0),
    );
    expect(below).toBeDefined();
  });

  it('lists the employer table before the monthly overview before the taxes table', () => {
    const flat = en_.pages.flat();
    const at = (label: string) => flat.findIndex((i) => i.str === label);
    expect(at('Totals per employer')).toBeGreaterThanOrEqual(0);
    expect(at('Totals per employer')).toBeLessThan(at('Monthly overview gross / net'));
    expect(at('Monthly overview gross / net')).toBeLessThan(
      at('All taxes and contributions per year'),
    );
    expect(at('Career total')).toBeLessThan(at('Monthly overview gross / net'));
  });

  it('shows every grid amount in whole euros and every tax amount with cents, unbroken', () => {
    const text = en_.pages.flat().map((i) => i.str);
    expect(text).toContain(fmt('en', String(123456.78 + 2026 + 1), true));
    expect(text).toContain(fmt('en', String(123456.78 + 2007 + 12), true));
    expect(text).toContain(fmt('en', '654321.09'.replace('654321.09', String(654321.09 + 2026))));
    expect(text).toContain(fmt('en', '120345.67'));
    expect(text.filter((s) => s === '22.1%')).toHaveLength(40);
  });

  it('lists years newest first in the monthly overview', () => {
    const flat = en_.pages.flat();
    const row = (y: number) => flat.find((i) => i.str === String(y) && i.x < 60);
    expect(row(2026)).toBeDefined();
    const page = (item: Item | undefined) => en_.pages.findIndex((p) => item && p.includes(item));
    const pos = (y: number) => page(row(y)) * 10000 - (row(y)?.y ?? 0);
    expect(pos(2026)).toBeLessThan(pos(2007));
  });

  it('uses German number formats and no English labels in the German PDF', () => {
    const text = de_.pages.flat().map((i) => i.str);
    expect(text).toContain('Berufsleben gesamt');
    expect(text).toContain('Summen je Arbeitgeber');
    expect(text).toContain('Monatsübersicht Brutto / Netto');
    expect(text).toContain(fmt('de', '120345.67'));
    expect(text).toContain('22,1 %');
    for (const english of [
      'Career total',
      'Monthly overview gross / net',
      'Totals per employer',
      'Employer',
    ]) {
      expect(text).not.toContain(english);
    }
    expect(de_.pages.flat().some((i) => i.str.includes('1,234.56'))).toBe(false);
  });

  it('contains no per-payslip-part table, source file names or corrected figures', () => {
    const text = en_.pages
      .flat()
      .map((i) => i.str)
      .join(' ');
    expect(text).not.toMatch(/\.pdf|Source file|Corrected|Issued|Correction|Payslip/i);
  });
});
