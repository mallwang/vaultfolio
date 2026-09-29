import { EMPLOYERS, RECORDS } from '../testing/aggregation.fixtures';
import { storedRecord } from '../testing/builders';
import { careerSummary, latestYearComparison } from './career';

describe('careerSummary', () => {
  it('returns the whole career first (more than one employer), then each employer', () => {
    expect(careerSummary(RECORDS, EMPLOYERS)).toEqual([
      {
        key: 'ALL',
        label: '',
        firstPeriod: '2024-10',
        lastPeriod: '2026-09',
        monthsEmployed: 23,
        employerCount: 2,
        totals: {
          gross: '112900.00',
          net: '71997.40',
          taxes: '18075.00',
          social: '22827.60',
          bonus: '1000.00',
        },
        perMonth: {
          gross: '4908.70',
          net: '3130.32',
          taxes: '785.87',
          social: '992.50',
          bonus: '43.48',
        },
        netRatio: '0.6377',
      },
      {
        key: 'emp-a',
        label: 'Northwind Instruments AG',
        firstPeriod: '2024-10',
        lastPeriod: '2024-12',
        monthsEmployed: 3,
        employerCount: 1,
        totals: {
          gross: '13000.00',
          net: '8452.00',
          taxes: '2100.00',
          social: '2448.00',
          bonus: '1000.00',
        },
        perMonth: {
          gross: '4333.33',
          net: '2817.33',
          taxes: '700.00',
          social: '816.00',
          bonus: '333.33',
        },
        netRatio: '0.6502',
      },
      {
        key: 'emp-b',
        label: 'Brightline Software GmbH',
        firstPeriod: '2025-01',
        lastPeriod: '2026-09',
        monthsEmployed: 20,
        employerCount: 1,
        totals: {
          gross: '99900.00',
          net: '63545.40',
          taxes: '15975.00',
          social: '20379.60',
          bonus: '0.00',
        },
        perMonth: {
          gross: '4995.00',
          net: '3177.27',
          taxes: '798.75',
          social: '1018.98',
          bonus: '0.00',
        },
        netRatio: '0.6361',
      },
    ]);
  });

  it('omits the whole-career entry with a single employer', () => {
    const onlyB = RECORDS.filter((r) => r.employerId === 'emp-b');
    expect(careerSummary(onlyB, EMPLOYERS).map((e) => e.key)).toEqual(['emp-b']);
    expect(careerSummary([], EMPLOYERS)).toEqual([]);
  });
});

describe('latestYearComparison', () => {
  it('compares months 1..n of the latest year with the same months of the previous year', () => {
    expect(latestYearComparison(RECORDS)).toEqual({
      year: 2026,
      months: 9,
      comparedMonths: [1, 9],
      current: {
        gross: '44900.00',
        net: '28565.40',
        taxes: '7175.00',
        social: '9159.60',
        bonus: '0.00',
        netRatio: '0.6362',
      },
      // 2025-01..09 without March: 8 × 5000.00; the payout-only March adds nothing
      previous: {
        gross: '40000.00',
        net: '25440.00',
        taxes: '6400.00',
        social: '8160.00',
        bonus: '0.00',
        netRatio: '0.6360',
      },
    });
  });

  it('has no previous figures without data in the previous year', () => {
    const only2026 = [storedRecord({ period: '2026-02', issued: '2026-02' })];
    expect(latestYearComparison(only2026)).toMatchObject({
      year: 2026,
      months: 2,
      comparedMonths: [1, 2],
      previous: null,
    });
  });

  it('is null without data', () => {
    expect(latestYearComparison([])).toBeNull();
  });
});
