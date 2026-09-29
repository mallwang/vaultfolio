import { emptyCertificateAmounts, type StoredCertificate } from '../model';
import { CERTIFICATES, EMPLOYERS, RECORDS } from '../testing/aggregation.fixtures';
import { storedRecord } from '../testing/builders';
import { dataCheck, dataCheckIssueCount } from './data-check';

describe('dataCheck (aggregation fixture)', () => {
  const rows = dataCheck(RECORDS, CERTIFICATES, EMPLOYERS);

  it('reports each employer and year', () => {
    expect(rows.map((r) => [r.year, r.employerId])).toEqual([
      [2024, 'emp-a'],
      [2025, 'emp-b'],
      [2026, 'emp-b'],
    ]);
  });

  it('marks a year without year-to-date totals and certificate as not available', () => {
    expect(rows[0]).toEqual({
      year: 2024,
      employerId: 'emp-a',
      employerLabel: 'Northwind Instruments AG',
      ytd: { status: 'NOT_AVAILABLE', compared: 0, differing: [] },
      certificate: { status: 'NOT_AVAILABLE', compared: 0, differing: [] },
      completeness: { status: 'COMPLETE', missingPeriods: [] },
      lateCorrections: [],
    });
  });

  it('names differing fields (never amounts), certificate matches, gap reported', () => {
    expect(rows[1]).toMatchObject({
      ytd: { status: 'DIFFERS', compared: 8, differing: ['wageTax'] },
      certificate: { status: 'MATCH', compared: 8, differing: [] },
      completeness: { status: 'MISSING', missingPeriods: ['2025-03'] },
    });
  });

  it('includes a correction issued with the last payslip', () => {
    expect(rows[2]).toMatchObject({
      ytd: { status: 'MATCH', compared: 8, differing: [] },
      certificate: { status: 'NOT_AVAILABLE' },
      completeness: { status: 'COMPLETE', missingPeriods: [] },
      lateCorrections: [],
    });
  });

  it('counts rows with issues', () => {
    expect(dataCheckIssueCount(rows)).toBe(1);
  });
});

describe('dataCheck rules', () => {
  const ytd = (wageTax: string) => ({
    taxGross: '10000.00',
    wageTax,
    soli: '0.00',
    churchTax: '0.00',
    health: '800.00',
    care: '180.00',
    pension: '930.00',
    unemployment: '130.00',
  });

  it('excludes corrections issued after the year’s last payslip from both comparisons and lists them', () => {
    const records = [
      storedRecord({ period: '2025-11', issued: '2025-11' }),
      storedRecord({ period: '2025-12', issued: '2025-12', amounts: { ytd: ytd('1600.00') } }),
      storedRecord({
        period: '2025-12',
        issued: '2026-04',
        kind: 'CORRECTION',
        seq: 5,
        amounts: {
          gross: '100.00',
          taxGross: '100.00',
          wageTax: '25.00',
          health: '0.00',
          care: '0.00',
          pension: '0.00',
          unemployment: '0.00',
          net: '75.00',
          payout: null,
        },
      }),
    ];
    const cert: StoredCertificate = {
      id: 'c',
      importId: 'i',
      employerId: 'emp-1',
      year: 2025,
      amounts: {
        ...emptyCertificateAmounts(),
        grossWage: '10000.00',
        wageTax: '1600.00',
        pensionEmployee: '930.00',
        health: '800.00',
        care: '180.00',
        unemployment: '130.00',
      },
    };
    const [row] = dataCheck(records, [cert], [{ id: 'emp-1', label: 'X' }]);
    expect(row.ytd).toEqual({ status: 'MATCH', compared: 8, differing: [] });
    expect(row.certificate).toEqual({ status: 'MATCH', compared: 8, differing: [] });
    expect(row.lateCorrections).toEqual([{ period: '2025-12', issued: '2026-04' }]);
  });

  it('adds multi-year lines 10–13 and subtracts voluntary KV/PV subsidies', () => {
    const subsidy = { employerSubsidy: { health: '100.00', care: '20.00' } };
    const records = [
      storedRecord({
        period: '2025-12',
        issued: '2025-12',
        amounts: {
          ...subsidy,
          ytd: {
            ...ytd('800.00'),
            taxGross: '5000.00',
            health: '500.00',
            care: '110.00',
            pension: '465.00',
            unemployment: '65.00',
          },
        },
      }),
    ];
    // record: taxGross 5000.00, wageTax 800.00, health 400.00, care 90.00 (own share)
    const cert: StoredCertificate = {
      id: 'c',
      importId: 'i',
      employerId: 'emp-1',
      year: 2025,
      amounts: {
        ...emptyCertificateAmounts(),
        grossWage: '4000.00',
        multiYearComp: '1000.00',
        wageTax: '600.00',
        multiYearWageTax: '200.00',
        pensionEmployee: '465.00',
        health: '500.00',
        employerSubsidyHealth: '100.00',
        care: '110.00',
        employerSubsidyCare: '20.00',
        unemployment: '65.00',
      },
    };
    const [row] = dataCheck(records, [cert], [{ id: 'emp-1', label: 'X' }]);
    expect(row.ytd.status).toBe('MATCH');
    expect(row.certificate).toEqual({ status: 'MATCH', compared: 8, differing: [] });
  });

  it('reports a certificate year without payslips as not comparable, not as an issue', () => {
    const cert: StoredCertificate = {
      id: 'c',
      importId: 'i',
      employerId: 'emp-1',
      year: 2019,
      amounts: { ...emptyCertificateAmounts(), grossWage: '1.00' },
    };
    const rows = dataCheck([], [cert], [{ id: 'emp-1', label: 'X' }]);
    expect(rows[0]).toMatchObject({
      year: 2019,
      certificate: { status: 'NOT_COMPARABLE', compared: 0, differing: [] },
      ytd: { status: 'NOT_AVAILABLE' },
      completeness: { status: 'NO_PAYSLIPS', missingPeriods: [] },
    });
    expect(dataCheckIssueCount(rows)).toBe(0);
  });

  it('treats a year with only a correction as having no payslips', () => {
    const records = [storedRecord({ period: '2025-04', issued: '2025-06', kind: 'CORRECTION' })];
    const [row] = dataCheck(records, [], [{ id: 'emp-1', label: 'X' }]);
    expect(row.completeness).toEqual({ status: 'NO_PAYSLIPS', missingPeriods: [] });
  });
});
