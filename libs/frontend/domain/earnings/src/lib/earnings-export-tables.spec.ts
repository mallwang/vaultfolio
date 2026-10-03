import type { CareerEntry, EarningsOverview, EarningsTables } from '@vaultfolio/api-contract';
import type { PdfSection } from '@vaultfolio/export';
import { de, en, type TranslationDictionary } from '@vaultfolio/frontend-shared-ui';
import { toExportTables } from './earnings-export-tables';
import { buildEarningsPdfSections } from './earnings-pdf-sections';
import { buildEarningsReport, emptyEarningsReport } from './earnings-report';

function translator(dict: TranslationDictionary) {
  return (key: string) =>
    key
      .split('.')
      .reduce<unknown>((node, part) => (node as TranslationDictionary)?.[part], dict) as string;
}

function entry(key: string, label: string, first: string, last: string, gross: string) {
  return {
    key,
    label,
    firstPeriod: first,
    lastPeriod: last,
    monthsEmployed: 12,
    employerCount: 1,
    totals: { gross, net: '60.00', taxes: '22.00', social: '18.00', bonus: '5.00' },
    perMonth: { gross: '0.00', net: '0.00', taxes: '0.00', social: '0.00', bonus: '0.00' },
    netRatio: '0.6000',
  } as CareerEntry;
}

const OVERVIEW = {
  hasData: true,
  career: [
    entry('e1', 'Old Corp', '2010-01', '2014-12', '100.00'),
    entry('ALL', 'All', '2010-01', '2026-09', '300.00'),
    entry('e2', 'New AG', '2015-01', '2026-09', '200.00'),
  ],
  latestYear: null,
  yearly: [
    {
      year: 2025,
      monthsEmployed: 12,
      gross: '60000.00',
      regular: '55000.00',
      bonus: '5000.00',
      net: '36000.00',
      taxes: '13000.00',
      social: '11000.00',
      taxRatio: '0.2167',
      socialRatio: '0.1833',
    },
    {
      year: 2026,
      monthsEmployed: 9,
      gross: '50000.00',
      regular: '50000.00',
      bonus: '0.00',
      net: '31000.00',
      taxes: '10000.00',
      social: '9000.00',
      taxRatio: '0.2000',
      socialRatio: '0.1800',
    },
  ],
  monthly: [],
  employerChanges: [],
  dataCheckIssues: 0,
} as unknown as EarningsOverview;

const TABLES = {
  monthGrid: {
    years: [2025, 2026],
    metrics: {
      gross: { '2026-01': '5000.40', '2026-02': '5000.40', '2025-12': '4000.10' },
      net: { '2026-01': '3100.20', '2025-12': '2500.05' },
    },
    bonusPeriods: [],
    missingPeriods: [],
  },
  taxesPerYear: [
    {
      year: 2026,
      employerId: 'e2',
      employerLabel: 'New AG',
      monthsEmployed: 9,
      gross: '50000.00',
      bonus: '0.00',
      taxGross: '50000.00',
      wageTax: '8000.00',
      soli: '0.00',
      churchTax: '700.00',
      health: '4000.00',
      care: '900.00',
      pension: '4100.00',
      unemployment: '600.00',
      taxRatio: '0.2000',
      socialRatio: '0.1800',
    },
  ],
  certificates: [],
} as unknown as EarningsTables;

const report = buildEarningsReport(OVERVIEW, TABLES);
const byId = (tables: ReturnType<typeof toExportTables>, id: string) => {
  const table = tables.find((t) => t.id === id);
  if (!table) throw new Error(`missing table ${id}`);
  return table;
};

describe('toExportTables', () => {
  const tables = toExportTables(report, translator(en), 'en');

  it('produces the four tables in PDF order with stable ids', () => {
    expect(tables.map((t) => t.id)).toEqual([
      'grossPerYear',
      'employers',
      'monthlyOverview',
      'taxesPerYear',
    ]);
    expect(tables.map((t) => t.title)).toEqual([
      'Gross per year',
      'Employers',
      'Monthly overview',
      'All taxes and contributions per year',
    ]);
  });

  it('lists the gross-per-year series newest first with canonical strings', () => {
    const rows = byId(tables, 'grossPerYear').rows;
    expect(rows.map((r) => r.cells['year'])).toEqual([2026, 2025]);
    expect(rows[1].cells).toMatchObject({
      monthsEmployed: 12,
      gross: '60000.00',
      taxRatio: '0.2167',
    });
  });

  it('puts the career total last in the employers table with the translated label', () => {
    const table = byId(tables, 'employers');
    expect(table.totalKey).toBe('careerTotal');
    expect(table.rows.map((r) => r.cells['employer'])).toEqual([
      'New AG',
      'Old Corp',
      'Career total',
    ]);
    expect(table.rows.map((r) => r.emphasis)).toEqual([undefined, undefined, 'total']);
    expect(table.rows[2].cells['gross']).toBe('300.00');
    expect(table.rows[0].cells['netRatio']).toBe('0.6000');
  });

  it('has 27 stable columns in the monthly overview with null for missing months', () => {
    const table = byId(tables, 'monthlyOverview');
    const keys = table.columns.map((c) => c.key);
    expect(keys).toHaveLength(27);
    expect(keys[0]).toBe('year');
    expect(keys.slice(1, 3)).toEqual(['gross01', 'gross02']);
    expect(keys[12]).toBe('gross12');
    expect(keys[13]).toBe('grossTotal');
    expect(keys[14]).toBe('net01');
    expect(keys[26]).toBe('netTotal');
    expect(table.columns[1].label).toBe('Gross January');
    expect(table.rows[0].cells).toMatchObject({
      year: 2026,
      gross01: '5000.40',
      gross03: null,
      grossTotal: '10000.80',
      net01: '3100.20',
      net02: null,
      netTotal: '3100.20',
    });
    expect(table.rows[1].cells).toMatchObject({ gross12: '4000.10', net12: '2500.05' });
  });

  it('keeps the tax table columns and values', () => {
    const table = byId(tables, 'taxesPerYear');
    expect(table.columns).toHaveLength(15);
    expect(table.rows[0].cells).toMatchObject({
      year: 2026,
      employer: 'New AG',
      months: 9,
      wageTax: '8000.00',
      socialRatio: '0.1800',
    });
  });

  it('uses identical keys in German and English while labels differ', () => {
    const german = toExportTables(report, translator(de), 'de');
    for (const table of tables) {
      const other = byId(german, table.id);
      expect(other.columns.map((c) => c.key)).toEqual(table.columns.map((c) => c.key));
      expect(other.title).not.toBe(table.title);
    }
    expect(byId(german, 'employers').rows.at(-1)?.cells['employer']).toBe('Berufsleben gesamt');
    expect(byId(german, 'monthlyOverview').columns[1].label).toBe('Brutto Januar');
  });

  it('yields the four tables with columns and no rows for an empty report', () => {
    const empty = toExportTables(emptyEarningsReport(), translator(en), 'en');
    expect(empty).toHaveLength(4);
    for (const table of empty) {
      expect(table.columns.length).toBeGreaterThan(0);
      expect(table.rows).toEqual([]);
    }
  });

  it('carries no payslip-level fields (file names, corrections, issue dates, kinds)', () => {
    const keys = tables.flatMap((t) => t.columns.map((c) => c.key));
    for (const forbidden of ['source', 'corrected', 'issued', 'kind', 'period', 'fileName']) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('shows the same figures as the PDF sections (parity)', () => {
    const sections = buildEarningsPdfSections(OVERVIEW, TABLES, translator(en), 'en');
    const pdf = (index: number) => {
      const s = sections[index] as Extract<PdfSection, { kind: 'table' }>;
      return s.rows;
    };
    const employersTable = byId(tables, 'employers');
    pdf(0).forEach((row, i) => {
      for (const key of ['employer', 'gross', 'net', 'netRatio', 'taxes', 'social', 'bonus']) {
        expect(employersTable.rows[i].cells[key]).toBe(row.cells[key]);
      }
      expect(employersTable.rows[i].emphasis).toBe(row.emphasis);
    });
    const monthly = byId(tables, 'monthlyOverview');
    pdf(1).forEach((row, i) => {
      for (let m = 1; m <= 12; m++) {
        const p = String(m).padStart(2, '0');
        expect(monthly.rows[i].cells[`gross${p}`]).toBe(row.cells[`m${m}`]);
        expect(monthly.rows[i].cells[`net${p}`]).toBe(row.cells[`n${m}`]);
      }
      expect(monthly.rows[i].cells['grossTotal']).toBe(row.cells['sum']);
      expect(monthly.rows[i].cells['netTotal']).toBe(row.cells['netSum']);
    });
    const taxes = byId(tables, 'taxesPerYear');
    pdf(2).forEach((row, i) => {
      for (const key of Object.keys(row.cells)) {
        const expected = key === 'year' ? Number(row.cells[key]) : row.cells[key];
        expect(taxes.rows[i].cells[key]).toBe(expected);
      }
    });
  });
});
