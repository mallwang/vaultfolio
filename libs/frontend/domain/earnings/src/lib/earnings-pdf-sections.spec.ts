import type {
  CareerEntry,
  EarningsOverview,
  EarningsTables,
  TaxYearRow,
} from '@vaultfolio/api-contract';
import type { PdfSection, PdfTableRow } from '@vaultfolio/export';
import { de, en, type TranslationDictionary } from '@vaultfolio/frontend-shared-ui';
import {
  PDF_CONTENT_WIDTH,
  starColumnWidth,
  buildEarningsPdfSections,
  emptyEarningsPdfSections,
} from './earnings-pdf-sections';

type TableSection = Extract<PdfSection, { kind: 'table' }>;

function translator(dict: TranslationDictionary) {
  return (key: string) =>
    key
      .split('.')
      .reduce<unknown>((node, part) => (node as TranslationDictionary)?.[part], dict) as string;
}

function entry(
  key: string,
  label: string,
  first: string,
  last: string,
  totals: [gross: string, net: string, taxes: string, social: string, bonus: string],
  netRatio: string,
): CareerEntry {
  const [gross, net, taxes, social, bonus] = totals;
  const zero = { gross: '0.00', net: '0.00', taxes: '0.00', social: '0.00', bonus: '0.00' };
  return {
    key,
    label,
    firstPeriod: first,
    lastPeriod: last,
    monthsEmployed: 12,
    employerCount: key === 'ALL' ? 3 : 1,
    totals: { gross, net, taxes, social, bonus },
    perMonth: zero,
    netRatio,
  };
}

// Deliberately not in recency order; the ALL entry comes first like the API may return it.
const CAREER: CareerEntry[] = [
  entry(
    'ALL',
    'All',
    '2010-01',
    '2026-09',
    ['600000.00', '370000.00', '130000.00', '100000.00', '40000.00'],
    '0.6167',
  ),
  entry(
    'e1',
    'Old Corp',
    '2010-01',
    '2014-12',
    ['100000.00', '60000.00', '22000.00', '18000.00', '5000.00'],
    '0.6000',
  ),
  entry(
    'e3',
    'Newest AG',
    '2020-07',
    '2026-09',
    ['300000.00', '190000.00', '60000.00', '50000.00', '25000.00'],
    '0.6333',
  ),
  entry(
    'e2',
    'Mid GmbH',
    '2015-01',
    '2020-06',
    ['200000.00', '120000.00', '48000.00', '32000.00', '10000.00'],
    '0.6000',
  ),
];

function taxRow(
  year: number,
  employerId: string,
  employerLabel: string,
  gross: string,
): TaxYearRow {
  return {
    year,
    employerId,
    employerLabel,
    monthsEmployed: 12,
    gross,
    bonus: '1000.00',
    taxGross: gross,
    wageTax: '100.00',
    soli: '0.00',
    churchTax: '8.00',
    health: '50.00',
    care: '10.00',
    pension: '60.00',
    unemployment: '8.00',
    taxRatio: '0.1800',
    socialRatio: '0.2004',
  };
}

const TABLES: EarningsTables = {
  monthGrid: {
    years: [2024, 2026, 2025],
    metrics: {
      gross: {
        '2026-01': '5000.40',
        '2026-02': '5000.40',
        '2025-12': '4000.10',
        '2024-03': '3000.00',
      },
      regular: {},
      bonus: {},
      net: {
        '2026-01': '3100.20',
        '2026-02': '3100.20',
        '2025-12': '2500.05',
      },
      taxes: {},
      social: {},
      payout: {},
    },
    bonusPeriods: [],
    missingPeriods: [],
  },
  taxesPerYear: [
    taxRow(2024, 'e3', 'Newest AG', '30000.00'),
    taxRow(2026, 'e2', 'Mid GmbH', '1.00'),
    taxRow(2026, 'e3', 'Newest AG', '60000.00'),
    taxRow(2025, 'e3', 'Newest AG', '55000.00'),
  ],
  certificates: [],
};

function overview(partial: Partial<EarningsOverview> = {}): EarningsOverview {
  return {
    hasData: true,
    career: CAREER,
    latestYear: null,
    yearly: [],
    monthly: [],
    employerChanges: [],
    dataCheckIssues: 0,
    ...partial,
  };
}

function tableOf(sections: PdfSection[], index: number): TableSection {
  const section = sections[index];
  if (section.kind !== 'table') throw new Error('expected a table section');
  return section;
}

const cents = (value: string | number | null) => Math.round(Number(value) * 100);

describe('buildEarningsPdfSections', () => {
  const sections = buildEarningsPdfSections(overview(), TABLES, translator(en), 'en');

  it('produces employer overview, monthly overview and taxes per year, in this order', () => {
    expect(sections.map((s) => s.kind)).toEqual(['table', 'table', 'table']);
    expect(sections.map((s) => (s.kind === 'table' ? s.title : ''))).toEqual([
      'Totals per employer',
      'Monthly overview gross / net',
      'All taxes and contributions per year',
    ]);
  });

  describe('employer overview', () => {
    const table = tableOf(sections, 0);

    it('lists employers newest first and ends with the career total', () => {
      expect(table.rows.map((r) => r.cells['employer'])).toEqual([
        'Newest AG',
        'Mid GmbH',
        'Old Corp',
        'Career total',
      ]);
      expect(table.rows.map((r) => r.emphasis)).toEqual([undefined, undefined, undefined, 'total']);
      expect(table.columns.map((c) => c.key)).toEqual([
        'employer',
        'gross',
        'net',
        'netRatio',
        'taxes',
        'social',
        'bonus',
      ]);
    });

    it('has a career total equal to the sum of the employer rows for every amount', () => {
      const employers = table.rows.slice(0, -1);
      const total = table.rows[table.rows.length - 1];
      for (const key of ['gross', 'net', 'taxes', 'social', 'bonus']) {
        const sum = employers.reduce((acc, r) => acc + cents(r.cells[key]), 0);
        expect(cents(total.cells[key])).toBe(sum);
      }
      expect(total.cells).toMatchObject({ gross: '600000.00', bonus: '40000.00' });
    });

    it('takes the net ratio as returned, without recomputing it', () => {
      expect(table.rows.map((r) => r.cells['netRatio'])).toEqual([
        '0.6333',
        '0.6000',
        '0.6000',
        '0.6167',
      ]);
    });

    it('orders employers with the same last period by first period, then label', () => {
      const tie = [
        entry(
          'a',
          'Beta',
          '2020-01',
          '2022-12',
          ['1.00', '1.00', '0.00', '0.00', '0.00'],
          '1.0000',
        ),
        entry(
          'b',
          'Alpha',
          '2021-01',
          '2022-12',
          ['1.00', '1.00', '0.00', '0.00', '0.00'],
          '1.0000',
        ),
        entry(
          'c',
          'Gamma',
          '2020-01',
          '2022-12',
          ['1.00', '1.00', '0.00', '0.00', '0.00'],
          '1.0000',
        ),
      ];
      const rows = tableOf(
        buildEarningsPdfSections(overview({ career: tie }), TABLES, translator(en), 'en'),
        0,
      ).rows;
      expect(rows.map((r) => r.cells['employer'])).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('uses the single employer as the career total when there is no ALL entry', () => {
      const only = entry(
        'e1',
        'Solo',
        '2020-01',
        '2022-12',
        ['10.00', '6.00', '2.00', '2.00', '1.00'],
        '0.6000',
      );
      const rows = tableOf(
        buildEarningsPdfSections(overview({ career: [only] }), TABLES, translator(en), 'en'),
        0,
      ).rows;
      expect(rows).toHaveLength(2);
      expect(rows[1].emphasis).toBe('total');
      expect(rows[1].cells).toEqual({ ...rows[0].cells, employer: 'Career total' });
    });

    it('declares widths that fit the landscape content width', () => {
      // Six shared-width columns must each hold e.g. "€1,234,567.89" at 8 pt (≈ 50 pt).
      expect(starColumnWidth(table.columns)).toBeGreaterThanOrEqual(60);
      expect(PDF_CONTENT_WIDTH).toBe(786);
    });
  });

  describe('monthly overview', () => {
    const table = tableOf(sections, 1);

    it('lists years newest first with the months in calendar order and a year sum', () => {
      expect(table.rows.map((r) => r.cells['year'])).toEqual(['2026', '2025', '2024']);
      expect(table.columns.map((c) => c.label)).toEqual([
        'Year',
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
        'Sum',
      ]);
    });

    it('shows whole-euro amounts, null for months without data, and exact year sums', () => {
      expect(table.columns.slice(1).every((c) => c.format === 'currencyWhole')).toBe(true);
      const y2026 = table.rows[0].cells;
      expect(y2026['m1']).toBe('5000.40');
      expect(y2026['m3']).toBeNull();
      expect(y2026['sum']).toBe('10000.80');
      expect(table.rows[1].cells).toMatchObject({ m12: '4000.10', sum: '4000.10' });
    });

    it('puts net below gross in every month cell and in the year sum', () => {
      expect(table.subtitle).toBe('Gross on top, net below');
      expect(table.columns.slice(1, 13).map((c) => c.secondaryKey)).toEqual(
        Array.from({ length: 12 }, (_, i) => `n${i + 1}`),
      );
      expect(table.columns[13].secondaryKey).toBe('netSum');
      expect(table.rows[0].cells).toMatchObject({
        m1: '5000.40',
        n1: '3100.20',
        n3: null,
        sum: '10000.80',
        netSum: '6200.40',
      });
      // A year without net data keeps its gross and shows no net.
      expect(table.rows[2].cells).toMatchObject({ m3: '3000.00', n3: null, netSum: '0.00' });
    });

    it('fits the landscape content width', () => {
      // "€1,505,703" at 7 pt is ≈ 34 pt.
      expect(starColumnWidth(table.columns)).toBeGreaterThanOrEqual(40);
    });
  });

  describe('taxes and contributions per year', () => {
    const table = tableOf(sections, 2);

    it('orders by year descending, then by employer recency', () => {
      expect(table.rows.map((r) => [r.cells['year'], r.cells['employer']])).toEqual([
        ['2026', 'Newest AG'],
        ['2026', 'Mid GmbH'],
        ['2025', 'Newest AG'],
        ['2024', 'Newest AG'],
      ]);
    });

    it('carries the 15 columns with exact amounts and ratios as returned', () => {
      expect(table.columns).toHaveLength(15);
      expect(table.rows[0].cells).toEqual({
        year: '2026',
        employer: 'Newest AG',
        months: 12,
        gross: '60000.00',
        bonus: '1000.00',
        taxGross: '60000.00',
        wageTax: '100.00',
        soli: '0.00',
        churchTax: '8.00',
        health: '50.00',
        care: '10.00',
        pension: '60.00',
        unemployment: '8.00',
        taxRatio: '0.1800',
        socialRatio: '0.2004',
      });
    });

    it('fits the landscape content width and lets only the employer wrap', () => {
      expect(table.columns.filter((c) => c.width === undefined)).toHaveLength(12);
      // "123.456,78 €" at 7 pt ≈ 41 pt.
      expect(starColumnWidth(table.columns)).toBeGreaterThanOrEqual(44);
      expect(table.columns.filter((c) => c.format === 'text').map((c) => c.key)).toEqual([
        'year',
        'employer',
      ]);
    });
  });

  it('contains no source file names or corrected-figure names', () => {
    const text = JSON.stringify(sections);
    expect(text).not.toMatch(/\.pdf|fileName|corrected|source/i);
  });

  it('does not mutate its inputs', () => {
    const before = JSON.stringify([CAREER, TABLES]);
    buildEarningsPdfSections(overview(), TABLES, translator(en), 'en');
    expect(JSON.stringify([CAREER, TABLES])).toBe(before);
  });
});

describe('earnings PDF section language', () => {
  const rowLabels = (rows: PdfTableRow[]) => rows.map((r) => r.cells['employer']);

  it('uses English titles, headers and the career-total label', () => {
    const s = buildEarningsPdfSections(overview(), TABLES, translator(en), 'en');
    expect(tableOf(s, 0).columns.map((c) => c.label)).toEqual([
      'Employer',
      'Gross',
      'Net',
      'Net ratio',
      'Taxes',
      'Social insurance',
      'Bonus',
    ]);
    expect(rowLabels(tableOf(s, 0).rows).pop()).toBe('Career total');
    expect(
      tableOf(s, 1)
        .columns.slice(1, 4)
        .map((c) => c.label),
    ).toEqual(['Jan', 'Feb', 'Mar']);
  });

  it('uses German titles, headers and the career-total label', () => {
    const s = buildEarningsPdfSections(overview(), TABLES, translator(de), 'de');
    expect(s.map((x) => (x.kind === 'table' ? x.title : ''))).toEqual([
      'Summen je Arbeitgeber',
      'Monatsübersicht Brutto / Netto',
      'Alle Steuern und Abgaben pro Jahr',
    ]);
    expect(
      tableOf(s, 0)
        .columns.map((c) => c.label)
        .slice(0, 4),
    ).toEqual(['Arbeitgeber', 'Brutto', 'Netto', 'Nettoquote']);
    expect(rowLabels(tableOf(s, 0).rows).pop()).toBe('Berufsleben gesamt');
    expect(
      tableOf(s, 1)
        .columns.slice(1, 4)
        .map((c) => c.label),
    ).toEqual(['Jan', 'Feb', 'Mär']);
  });

  it('has no English table or section label in the German output', () => {
    const s = buildEarningsPdfSections(overview(), TABLES, translator(de), 'de');
    const labels = s.flatMap((x) =>
      x.kind === 'table' ? [x.title, x.subtitle ?? '', ...x.columns.map((c) => c.label)] : [x.text],
    );
    for (const english of [
      'Employer',
      'Career total',
      'Monthly overview gross / net',
      'Gross',
      'Year',
      'Sum',
      'Taxes',
    ]) {
      expect(labels).not.toContain(english);
    }
  });
});

describe('empty states', () => {
  it('shows a single translated text section without data', () => {
    expect(
      buildEarningsPdfSections(
        overview({ hasData: false, career: [] }),
        TABLES,
        translator(en),
        'en',
      ),
    ).toEqual([{ kind: 'text', text: 'There is no earnings data yet.' }]);
    expect(emptyEarningsPdfSections(translator(de))).toEqual([
      { kind: 'text', text: 'Es liegen noch keine Einkommensdaten vor.' },
    ]);
  });
});
