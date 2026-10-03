import type {
  CareerEntry,
  EarningsOverview,
  EarningsTables,
  TaxYearRow,
  YearlyPoint,
} from '@vaultfolio/api-contract';
import { buildEarningsReport } from './earnings-report';

function entry(key: string, label: string, first: string, last: string, gross: string) {
  return {
    key,
    label,
    firstPeriod: first,
    lastPeriod: last,
    monthsEmployed: 12,
    employerCount: key === 'ALL' ? 2 : 1,
    totals: { gross, net: '1.00', taxes: '1.00', social: '1.00', bonus: '1.00' },
    perMonth: { gross: '0.00', net: '0.00', taxes: '0.00', social: '0.00', bonus: '0.00' },
    netRatio: '0.6000',
  } as CareerEntry;
}

function point(year: number): YearlyPoint {
  return {
    year,
    monthsEmployed: 12,
    gross: '1.00',
    regular: '1.00',
    bonus: '0.00',
    net: '1.00',
    taxes: '0.00',
    social: '0.00',
    taxRatio: '0.1',
    socialRatio: '0.1',
  } as YearlyPoint;
}

function taxRow(year: number, employerId: string, employerLabel: string): TaxYearRow {
  return { year, employerId, employerLabel, monthsEmployed: 12 } as TaxYearRow;
}

const TABLES: EarningsTables = {
  monthGrid: {
    years: [2025, 2026],
    metrics: {
      gross: { '2026-01': '5000.40', '2026-02': '5000.40', '2025-12': '4000.10' },
      net: { '2026-01': '3100.20', '2025-12': '2500.05' },
    },
    bonusPeriods: [],
    missingPeriods: [],
  },
  taxesPerYear: [taxRow(2025, 'e2', 'New'), taxRow(2026, 'e1', 'Old'), taxRow(2026, 'e2', 'New')],
  certificates: [],
} as unknown as EarningsTables;

function overview(partial: Partial<EarningsOverview> = {}): EarningsOverview {
  return {
    hasData: true,
    career: [
      entry('e1', 'Old', '2010-01', '2014-12', '100.00'),
      entry('ALL', 'All', '2010-01', '2026-09', '300.00'),
      entry('e2', 'New', '2015-01', '2026-09', '200.00'),
    ],
    latestYear: null,
    yearly: [point(2024), point(2026), point(2025)],
    monthly: [],
    employerChanges: [],
    dataCheckIssues: 0,
    ...partial,
  };
}

describe('buildEarningsReport', () => {
  const report = buildEarningsReport(overview(), TABLES);

  it('orders employers by recency and separates the ALL entry as total', () => {
    expect(report.employers.map((e) => e.key)).toEqual(['e2', 'e1']);
    expect(report.total?.key).toBe('ALL');
    const sum = report.employers.reduce((s, e) => s + Math.round(Number(e.totals.gross) * 100), 0);
    expect(sum).toBe(Math.round(Number(report.total?.totals.gross) * 100));
  });

  it('uses the single employer as the career total when there is no ALL entry', () => {
    const single = buildEarningsReport(
      overview({ career: [entry('e1', 'Only', '2020-01', '2026-09', '1.00')] }),
      TABLES,
    );
    expect(single.total?.key).toBe('e1');
  });

  it('lists the yearly series newest first', () => {
    expect(report.yearly.map((p) => p.year)).toEqual([2026, 2025, 2024]);
  });

  it('builds the month grid newest year first with exact sums and null for missing months', () => {
    expect(report.monthGrid.map((r) => r.year)).toEqual([2026, 2025]);
    const y2026 = report.monthGrid[0];
    expect(y2026.gross).toHaveLength(12);
    expect(y2026.gross.slice(0, 3)).toEqual(['5000.40', '5000.40', null]);
    expect(y2026.net.slice(0, 2)).toEqual(['3100.20', null]);
    expect(y2026.grossSum).toBe('10000.80');
    expect(y2026.netSum).toBe('3100.20');
    expect(report.monthGrid[1].gross[11]).toBe('4000.10');
    expect(report.monthGrid[1].net[11]).toBe('2500.05');
  });

  it('sorts tax rows by year descending, then employer recency', () => {
    expect(report.taxRows.map((r) => `${r.year}/${r.employerId}`)).toEqual([
      '2026/e2',
      '2026/e1',
      '2025/e2',
    ]);
  });

  it('is empty without data', () => {
    expect(buildEarningsReport(overview({ hasData: false }), TABLES)).toEqual({
      yearly: [],
      employers: [],
      total: null,
      monthGrid: [],
      taxRows: [],
    });
  });
});
